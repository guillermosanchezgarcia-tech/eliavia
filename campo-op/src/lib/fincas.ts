// Utilidades para mostrar y usar los datos de una finca.

import { NOMBRES_TIPO_FINCA, NOMBRES_TIPO_INVERNADERO } from './catalogos'
import { centro } from './geometria'
import { coincide, comparar, normalizar } from './formato'
import { nombreMunicipio } from './sigpac'
import type { Finca, Recinto, Socio } from './tipos'

export interface Ubicacion {
  latitud: number
  longitud: number
  /** De dónde sale: el punto GPS guardado o el centro del primer recinto SIGPAC. */
  origen: 'gps' | 'recinto'
}

/** Dónde está la finca: su punto GPS, o si no lo tiene, el centro de un recinto. */
export function ubicacionFinca(finca: Pick<Finca, 'latitud' | 'longitud'>, recintos: Pick<Recinto, 'geometria'>[]): Ubicacion | null {
  if (finca.latitud !== null && finca.longitud !== null) {
    return { latitud: finca.latitud, longitud: finca.longitud, origen: 'gps' }
  }
  for (const r of recintos) {
    const c = centro(r.geometria)
    if (c) return { latitud: c[0], longitud: c[1], origen: 'recinto' }
  }
  return null
}

/** Abre Google Maps con la ruta hasta la finca (desde donde esté el usuario). */
export function enlaceComoLlegar(u: Pick<Ubicacion, 'latitud' | 'longitud'>): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${u.latitud.toFixed(6)},${u.longitud.toFixed(6)}&travelmode=driving`
}

/** «Invernadero raspa y amagado», «Aire libre»… */
export function descripcionTipo(f: Pick<Finca, 'tipo' | 'tipo_invernadero' | 'tipo_invernadero_otro'>): string {
  if (!f.tipo) return ''
  if (f.tipo === 'aire_libre') return NOMBRES_TIPO_FINCA.aire_libre
  if (!f.tipo_invernadero) return NOMBRES_TIPO_FINCA.invernadero
  if (f.tipo_invernadero === 'otro') {
    return f.tipo_invernadero_otro ? `Invernadero ${f.tipo_invernadero_otro.toLowerCase()}` : 'Invernadero (otro tipo)'
  }
  return `Invernadero ${NOMBRES_TIPO_INVERNADERO[f.tipo_invernadero].toLowerCase()}`
}

/** Suma las superficies de los recintos que la tienen. Devuelve null si ninguno la tiene. */
export function sumaSuperficies(recintos: { superficie_ha: number | null }[]): number | null {
  const con = recintos.filter((r) => r.superficie_ha !== null)
  if (!con.length) return null
  return Math.round(con.reduce((s, r) => s + (r.superficie_ha ?? 0), 0) * 10000) / 10000
}

export type OrdenFincas = 'nombre' | 'socio' | 'superficie'

/** Valor de un filtro que significa «las que no tienen ese dato» (sin cultivo, sin municipio…). */
export const SIN_VALOR = '_sin'

export interface CriteriosFincas {
  busqueda: string
  socio: string
  tipo: string
  cultivo: string
  /** «provincia:municipio», p. ej. «4:104». */
  municipio: string
  certificacion: string
  campana: string
  /** Solo las fincas de socios que no están de baja. */
  soloActivos: boolean
  orden: OrdenFincas
}

/** ¿Este dato de la finca cumple el filtro? Ignora mayúsculas y tildes; `SIN_VALOR` pide los que no lo tienen. */
function cumple(filtro: string, valor: string | null | undefined): boolean {
  if (!filtro) return true
  return filtro === SIN_VALOR ? !normalizar(valor) : normalizar(valor) === normalizar(filtro)
}

/**
 * Filtra y ordena las fincas.
 * @param textos texto en el que se busca de cada finca (por su id)
 * @param socios nombre y estado de cada socio (por su id), para ordenar y para «solo activos»
 */
export function filtrarFincas(
  fincas: Finca[],
  textos: Map<string, string>,
  socios: ReadonlyMap<string, Pick<Socio, 'nombre' | 'estado'>>,
  c: CriteriosFincas,
): Finca[] {
  const lista = fincas.filter(
    (f) =>
      (!c.socio || f.socio_id === c.socio) &&
      (!c.soloActivos || socios.get(f.socio_id)?.estado !== 'baja') &&
      (!c.tipo || (c.tipo === SIN_VALOR ? !f.tipo : f.tipo === c.tipo)) &&
      cumple(c.cultivo, f.cultivo) &&
      cumple(c.campana, f.campana) &&
      (!c.municipio || (c.municipio === SIN_VALOR ? f.municipio === null : `${f.provincia}:${f.municipio}` === c.municipio)) &&
      (!c.certificacion ||
        (c.certificacion === SIN_VALOR ? f.certificaciones.length === 0 : f.certificaciones.some((x) => cumple(c.certificacion, x)))) &&
      (!c.busqueda || coincide(textos.get(f.id) ?? '', c.busqueda)),
  )
  const socio = (f: Finca) => socios.get(f.socio_id)?.nombre ?? ''
  return lista.sort((a, b) => {
    if (c.orden === 'superficie') return (b.superficie_ha ?? -1) - (a.superficie_ha ?? -1) || comparar(a.nombre, b.nombre)
    if (c.orden === 'socio') return comparar(socio(a), socio(b)) || comparar(a.nombre, b.nombre)
    return comparar(a.nombre, b.nombre) || comparar(socio(a), socio(b))
  })
}

/**
 * Texto en el que se busca de cada finca: su nombre, cultivo, campaña, socio,
 * municipio, tipo, certificaciones y las referencias SIGPAC («pol 23 parc 372»).
 */
export function construirTextos(
  fincas: Finca[],
  recintos: Pick<Recinto, 'finca_id' | 'poligono' | 'parcela'>[],
  socios: Pick<Socio, 'id' | 'nombre' | 'codigo'>[],
): Map<string, string> {
  const porId = new Map(socios.map((s) => [s.id, s]))
  const referencias = new Map<string, string>()
  for (const r of recintos) {
    referencias.set(r.finca_id, `${referencias.get(r.finca_id) ?? ''} pol ${r.poligono} parc ${r.parcela} ${r.poligono} ${r.parcela}`)
  }
  const textos = new Map<string, string>()
  for (const f of fincas) {
    const socio = porId.get(f.socio_id)
    textos.set(
      f.id,
      [
        f.nombre,
        f.cultivo,
        f.campana,
        socio?.nombre,
        socio?.codigo,
        nombreMunicipio(f.provincia, f.municipio),
        descripcionTipo(f),
        f.certificaciones.join(' '),
        referencias.get(f.id),
      ]
        .filter(Boolean)
        .join(' '),
    )
  }
  return textos
}

/** Nombres de los filtros que viajan en la dirección (/fincas?cultivo=Tomate). */
export const PARAMETROS_FILTRO = ['socio', 'tipo', 'cultivo', 'municipio', 'certificacion', 'campana', 'activos'] as const

/** Lee la búsqueda y los filtros de la dirección. */
export function criteriosDeParametros(p: URLSearchParams): CriteriosFincas {
  const orden = p.get('orden')
  return {
    busqueda: p.get('q') ?? '',
    socio: p.get('socio') ?? '',
    tipo: p.get('tipo') ?? '',
    cultivo: p.get('cultivo') ?? '',
    municipio: p.get('municipio') ?? '',
    certificacion: p.get('certificacion') ?? '',
    campana: p.get('campana') ?? '',
    soloActivos: p.get('activos') === '1',
    orden: orden === 'socio' || orden === 'superficie' ? orden : 'nombre',
  }
}

/** ¿Hay alguna búsqueda o filtro activo? */
export function hayFiltros(c: CriteriosFincas): boolean {
  return Boolean(c.busqueda || c.socio || c.tipo || c.cultivo || c.municipio || c.certificacion || c.campana || c.soloActivos)
}
