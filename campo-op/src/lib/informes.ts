// Totales de la OP: cuántas fincas, socios y hectáreas hay por cultivo, municipio, certificación…
// Son funciones puras (sin pantalla ni base de datos) para poder probarlas con facilidad.

import { NOMBRES_TIPO_FINCA } from './catalogos'
import { SIN_VALOR } from './fincas'
import { comparar, normalizar } from './formato'
import { nombreMunicipio, nombreProvincia } from './sigpac'
import { PROVINCIA_ALMERIA } from './codigosSigpac'
import type { Finca, Socio } from './tipos'

export type Dimension = 'cultivo' | 'municipio' | 'certificacion' | 'tipo' | 'campana'

/** Los totales que muestra el informe (la campaña solo sirve para filtrar). */
export type DimensionInforme = Exclude<Dimension, 'campana'>
export const DIMENSIONES_INFORME: DimensionInforme[] = ['cultivo', 'municipio', 'certificacion', 'tipo']

export const NOMBRES_DIMENSION: Record<Dimension, string> = {
  cultivo: 'Cultivo',
  municipio: 'Municipio',
  certificacion: 'Certificación',
  tipo: 'Tipo de finca',
  campana: 'Campaña',
}

/** Texto de la fila de «lo que no tiene dato» en cada tipo de total. */
export const TEXTO_SIN_DATO: Record<Dimension, string> = {
  cultivo: 'Sin cultivo indicado',
  municipio: 'Sin municipio',
  certificacion: 'Sin certificación',
  tipo: 'Sin tipo indicado',
  campana: 'Sin campaña',
}

export interface FiltrosInforme {
  /** Campaña («2025/2026»), `SIN_VALOR` para las que no la tienen o vacío para todas. */
  campana: string
  /** «invernadero», «aire_libre», `SIN_VALOR` o vacío para todos. */
  tipo: string
  /** Contar también las fincas de socios dados de baja. */
  incluirBajas: boolean
}

export const SIN_FILTROS: FiltrosInforme = { campana: '', tipo: '', incluirBajas: false }

export interface Resumen {
  socios: number
  fincas: number
  ha: number
  /** Fincas que no tienen la superficie indicada (no suman hectáreas). */
  sinSuperficie: number
}

export interface FilaTotales {
  /** Valor con el que se filtra la lista de fincas (`SIN_VALOR` en la fila de «sin dato»). */
  clave: string
  etiqueta: string
  fincas: number
  socios: number
  ha: number
  sinSuperficie: number
  /** Parte de las hectáreas totales, de 0 a 1. */
  parte: number
}

/** Quita los decimales sobrantes de sumar hectáreas (0,1 + 0,2 = 0,30000000000000004). */
export function redondearHa(ha: number): number {
  return Math.round(ha * 10000) / 10000
}

/** Fincas que entran en el informe según los filtros elegidos. */
export function fincasDelInforme(fincas: Finca[], socios: Pick<Socio, 'id' | 'estado'>[], filtros: FiltrosInforme): Finca[] {
  const deBaja = new Set(socios.filter((s) => s.estado === 'baja').map((s) => s.id))
  return fincas.filter(
    (f) =>
      (filtros.incluirBajas || !deBaja.has(f.socio_id)) &&
      (!filtros.tipo || (filtros.tipo === SIN_VALOR ? !f.tipo : f.tipo === filtros.tipo)) &&
      (!filtros.campana || (filtros.campana === SIN_VALOR ? !normalizar(f.campana) : normalizar(f.campana) === normalizar(filtros.campana))),
  )
}

export function resumenDe(fincas: Finca[]): Resumen {
  let ha = 0
  let sinSuperficie = 0
  for (const f of fincas) {
    if (f.superficie_ha === null) sinSuperficie += 1
    else ha += f.superficie_ha
  }
  return { socios: new Set(fincas.map((f) => f.socio_id)).size, fincas: fincas.length, ha: redondearHa(ha), sinSuperficie }
}

/** Nombre del municipio; si no es de Almería se añade la provincia para no confundirlo. */
export function etiquetaMunicipio(provincia: number, municipio: number): string {
  const nombre = nombreMunicipio(provincia, municipio)
  return provincia === PROVINCIA_ALMERIA ? nombre : `${nombre} (${nombreProvincia(provincia)})`
}

interface Valor {
  /** Lo que identifica al grupo: dos escrituras distintas del mismo cultivo caen en el mismo. */
  grupo: string
  /** Cómo se escribió en esta finca. */
  escrito: string
}

/** A qué grupos pertenece una finca en cada tipo de total. Una finca puede tener varias certificaciones. */
function valoresDe(f: Finca, dimension: Dimension): Valor[] {
  switch (dimension) {
    case 'cultivo':
    case 'campana': {
      const escrito = ((dimension === 'cultivo' ? f.cultivo : f.campana) ?? '').trim().replace(/\s+/g, ' ')
      return escrito ? [{ grupo: normalizar(escrito), escrito }] : []
    }
    case 'municipio':
      return f.municipio === null ? [] : [{ grupo: `${f.provincia}:${f.municipio}`, escrito: etiquetaMunicipio(f.provincia, f.municipio) }]
    case 'tipo':
      return f.tipo ? [{ grupo: f.tipo, escrito: NOMBRES_TIPO_FINCA[f.tipo] }] : []
    case 'certificacion': {
      const vistos = new Map<string, Valor>()
      for (const c of f.certificaciones) {
        const escrito = c.trim().replace(/\s+/g, ' ')
        const grupo = normalizar(escrito)
        if (grupo && !vistos.has(grupo)) vistos.set(grupo, { grupo, escrito })
      }
      return [...vistos.values()]
    }
  }
}

interface Acumulado {
  grupo: string
  escrituras: Map<string, number>
  socios: Set<string>
  fincas: number
  ha: number
  sinSuperficie: number
}

/**
 * Totales de las fincas agrupadas por cultivo, municipio, certificación o tipo.
 * «Tomate», «tomate» y «Tómate» cuentan como el mismo cultivo (se muestra la forma más usada).
 * La fila «sin dato» va siempre la última; las demás, de más a menos hectáreas.
 */
export function totalesPor(fincas: Finca[], dimension: Dimension): FilaTotales[] {
  const grupos = new Map<string, Acumulado>()
  const sin: Acumulado = { grupo: SIN_VALOR, escrituras: new Map(), socios: new Set(), fincas: 0, ha: 0, sinSuperficie: 0 }

  const sumar = (a: Acumulado, f: Finca, escrito?: string) => {
    a.fincas += 1
    a.socios.add(f.socio_id)
    if (f.superficie_ha === null) a.sinSuperficie += 1
    else a.ha += f.superficie_ha
    if (escrito) a.escrituras.set(escrito, (a.escrituras.get(escrito) ?? 0) + 1)
  }

  for (const f of fincas) {
    const valores = valoresDe(f, dimension)
    if (!valores.length) sumar(sin, f)
    for (const v of valores) {
      let a = grupos.get(v.grupo)
      if (!a) {
        a = { grupo: v.grupo, escrituras: new Map(), socios: new Set(), fincas: 0, ha: 0, sinSuperficie: 0 }
        grupos.set(v.grupo, a)
      }
      sumar(a, f, v.escrito)
    }
  }

  const totalHa = resumenDe(fincas).ha
  const aFila = (a: Acumulado, etiqueta: string, clave: string): FilaTotales => ({
    clave,
    etiqueta,
    fincas: a.fincas,
    socios: a.socios.size,
    ha: redondearHa(a.ha),
    sinSuperficie: a.sinSuperficie,
    parte: totalHa > 0 ? Math.min(1, a.ha / totalHa) : 0,
  })

  const filas = [...grupos.values()].map((a) => {
    // La forma de escribirlo más repetida; si empatan, la primera por orden alfabético.
    const [etiqueta] = [...a.escrituras.entries()].sort((x, y) => y[1] - x[1] || comparar(x[0], y[0]))[0]
    // Cultivo, certificación y campaña se filtran por su nombre; municipio y tipo, por su código.
    const clave = dimension === 'municipio' || dimension === 'tipo' ? a.grupo : etiqueta
    return aFila(a, etiqueta, clave)
  })
  filas.sort((x, y) => y.ha - x.ha || y.fincas - x.fincas || comparar(x.etiqueta, y.etiqueta))
  if (sin.fincas) filas.push(aFila(sin, TEXTO_SIN_DATO[dimension], SIN_VALOR))
  return filas
}

/** Opciones de un desplegable de filtro: «Tomate (12)». Las campañas, de la más reciente a la más antigua. */
export function opcionesDeFiltro(fincas: Finca[], dimension: Dimension): { valor: string; texto: string }[] {
  const filas = totalesPor(fincas, dimension)
  const con = filas.filter((f) => f.clave !== SIN_VALOR).sort((a, b) => (dimension === 'campana' ? comparar(b.etiqueta, a.etiqueta) : comparar(a.etiqueta, b.etiqueta)))
  const sin = filas.filter((f) => f.clave === SIN_VALOR)
  return [...con, ...sin].map((f) => ({ valor: f.clave, texto: `${f.etiqueta} (${f.fincas})` }))
}
