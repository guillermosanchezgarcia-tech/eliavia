// Utilidades para mostrar y usar los datos de una finca.

import { NOMBRES_TIPO_FINCA, NOMBRES_TIPO_INVERNADERO } from './catalogos'
import { centro } from './geometria'
import { coincide, comparar } from './formato'
import type { Finca, Recinto } from './tipos'

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

export interface CriteriosFincas {
  busqueda: string
  socio: string
  tipo: string
  cultivo: string
  /** «provincia:municipio», p. ej. «4:104». */
  municipio: string
  certificacion: string
  orden: OrdenFincas
}

/**
 * Filtra y ordena las fincas.
 * @param textos texto en el que se busca de cada finca (por su id)
 * @param nombresSocio nombre de cada socio (por su id), para ordenar
 */
export function filtrarFincas(
  fincas: Finca[],
  textos: Map<string, string>,
  nombresSocio: Map<string, string>,
  c: CriteriosFincas,
): Finca[] {
  const lista = fincas.filter(
    (f) =>
      (!c.socio || f.socio_id === c.socio) &&
      (!c.tipo || f.tipo === c.tipo) &&
      (!c.cultivo || f.cultivo === c.cultivo) &&
      (!c.municipio || `${f.provincia}:${f.municipio}` === c.municipio) &&
      (!c.certificacion || f.certificaciones.includes(c.certificacion)) &&
      (!c.busqueda || coincide(textos.get(f.id) ?? '', c.busqueda)),
  )
  const socio = (f: Finca) => nombresSocio.get(f.socio_id) ?? ''
  return lista.sort((a, b) => {
    if (c.orden === 'superficie') return (b.superficie_ha ?? -1) - (a.superficie_ha ?? -1) || comparar(a.nombre, b.nombre)
    if (c.orden === 'socio') return comparar(socio(a), socio(b)) || comparar(a.nombre, b.nombre)
    return comparar(a.nombre, b.nombre) || comparar(socio(a), socio(b))
  })
}
