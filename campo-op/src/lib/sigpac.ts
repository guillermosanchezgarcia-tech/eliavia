// Consultas al servicio público del SIGPAC (FEGA, Ministerio de Agricultura).
// Necesitan conexión. Documentación: https://sigpac-hubcloud.es

import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { guardarAjuste, leerAjuste } from '../datos/db'
import { MUNICIPIOS_ALMERIA, PROVINCIA_ALMERIA, PROVINCIAS } from './codigosSigpac'
import { redondearGeometria } from './geometria'

const SERVIDOR = 'https://sigpac-hubcloud.es'

/** Referencia SIGPAC completa. `recinto` puede faltar (parcela entera). */
export interface ReferenciaSigpac {
  provincia: number
  municipio: number
  agregado: number
  zona: number
  poligono: number
  parcela: number
  recinto: number | null
}

export interface RecintoSigpac extends ReferenciaSigpac {
  recinto: number
  superficie_ha: number | null
  uso_sigpac: string | null
  geometria: Geometry | null
}

export class ErrorSigpac extends Error {}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Pide un JSON al SIGPAC. El servidor a veces corta la conexión: se reintenta. */
async function pedir<T>(ruta: string): Promise<T> {
  if (!navigator.onLine) throw new ErrorSigpac('Necesitas conexión para consultar el SIGPAC.')
  let ultimo: unknown
  for (let intento = 0; intento < 3; intento++) {
    try {
      const r = await fetch(`${SERVIDOR}${ruta}`, { signal: AbortSignal.timeout(20000) })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return (await r.json()) as T
    } catch (e) {
      ultimo = e
      await esperar(700 * (intento + 1))
    }
  }
  console.warn('SIGPAC no responde', ultimo)
  throw new ErrorSigpac('El SIGPAC no responde ahora mismo. Inténtalo de nuevo en un momento.')
}

interface PropiedadesSigpac {
  provincia: number
  municipio: number
  agregado: number
  zona: number
  poligono: number
  parcela: number
  recinto: number
  superficie: number | null
  uso_sigpac: string | null
}

function aRecinto(f: Feature<Geometry | null, PropiedadesSigpac>): RecintoSigpac {
  const p = f.properties
  return {
    provincia: p.provincia,
    municipio: p.municipio,
    agregado: p.agregado,
    zona: p.zona,
    poligono: p.poligono,
    parcela: p.parcela,
    recinto: p.recinto,
    superficie_ha: p.superficie ?? null,
    uso_sigpac: p.uso_sigpac ?? null,
    geometria: f.geometry ? redondearGeometria(f.geometry) : null,
  }
}

type Respuesta = FeatureCollection<Geometry | null, PropiedadesSigpac>

/** Recinto SIGPAC que hay en unas coordenadas (por ejemplo, la posición del GPS). */
export async function recintoEnPunto(latitud: number, longitud: number): Promise<RecintoSigpac | null> {
  const d = await pedir<Respuesta>(
    `/servicioconsultassigpac/query/recinfobypoint/4326/${longitud.toFixed(7)}/${latitud.toFixed(7)}.geojson`,
  )
  return d.features?.length ? aRecinto(d.features[0]) : null
}

const tramo = (r: ReferenciaSigpac) => `${r.provincia}/${r.municipio}/${r.agregado}/${r.zona}/${r.poligono}/${r.parcela}`

/** Busca por referencia. Sin número de recinto devuelve todos los de la parcela. */
export async function buscarRecintos(r: ReferenciaSigpac): Promise<RecintoSigpac[]> {
  const ruta =
    r.recinto === null
      ? `/servicioconsultassigpac/query/recinfoparc/${tramo(r)}.geojson`
      : `/servicioconsultassigpac/query/recinfo/${tramo(r)}/${r.recinto}.geojson`
  const d = await pedir<Respuesta>(ruta)
  return (d.features ?? []).map(aRecinto).sort((a, b) => a.recinto - b.recinto)
}

// ---------------------------------------------------------------------------
// Provincias y municipios
// ---------------------------------------------------------------------------

export function nombreProvincia(codigo: number): string {
  return PROVINCIAS.find(([c]) => c === codigo)?.[1] ?? `Provincia ${codigo}`
}

/** «Ejido (El)» → «El Ejido» */
function ordenarArticulo(nombre: string) {
  const m = nombre.match(/^(.*) \((El|La|Los|Las)\)$/)
  return m ? `${m[2]} ${m[1]}` : nombre
}

/**
 * Municipios de una provincia. Los de Almería vienen con la app; los demás se
 * descargan del SIGPAC la primera vez y se guardan en el móvil.
 */
export async function municipiosDe(provincia: number): Promise<[number, string][]> {
  if (provincia === PROVINCIA_ALMERIA) return MUNICIPIOS_ALMERIA
  const clave = `municipios:${provincia}`
  const guardados = await leerAjuste<[number, string][]>(clave)
  if (guardados) return guardados
  const d = await pedir<{ codigos: { codigo: number; descripcion: string }[] }>(`/codigossigpac/municipio${provincia}.json`)
  const lista = d.codigos.map((c) => [c.codigo, ordenarArticulo(c.descripcion)] as [number, string])
  await guardarAjuste(clave, lista)
  return lista
}

/** Nombre del municipio si se conoce sin conexión; si no, su código. */
export function nombreMunicipio(provincia: number, municipio: number | null | undefined, lista?: [number, string][]) {
  if (municipio === null || municipio === undefined) return ''
  const fuente = lista ?? (provincia === PROVINCIA_ALMERIA ? MUNICIPIOS_ALMERIA : [])
  return fuente.find(([c]) => c === municipio)?.[1] ?? `Municipio ${municipio}`
}

/** «Pol. 23 · Parc. 372 · Rec. 3» */
export function textoReferencia(r: Pick<ReferenciaSigpac, 'poligono' | 'parcela' | 'recinto'>): string {
  return `Pol. ${r.poligono} · Parc. ${r.parcela}${r.recinto !== null ? ` · Rec. ${r.recinto}` : ''}`
}

/** Referencia completa en el formato oficial: «04:104:0:0:23:372:3». */
export function codigoReferencia(r: ReferenciaSigpac): string {
  return [String(r.provincia).padStart(2, '0'), r.municipio, r.agregado, r.zona, r.poligono, r.parcela, r.recinto ?? '']
    .join(':')
    .replace(/:$/, '')
}

/** Un recinto dentro de un formulario: ya guardado (`existente`) o recién añadido. */
export interface RecintoBorrador extends RecintoSigpac {
  clave: string
  existente: boolean
}

/** Identifica un recinto por su referencia, para no añadir el mismo dos veces. */
export function claveRecinto(r: Pick<ReferenciaSigpac, 'provincia' | 'municipio' | 'agregado' | 'zona' | 'poligono' | 'parcela' | 'recinto'>) {
  return [r.provincia, r.municipio, r.agregado, r.zona, r.poligono, r.parcela, r.recinto].join('/')
}
