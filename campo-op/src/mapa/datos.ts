// Prepara los datos de las fincas para dibujarlas y busca a qué finca
// pertenece un recinto SIGPAC.

import type { Geometry, Position } from 'geojson'
import { db } from '../datos/db'
import { centro } from '../lib/geometria'
import { ubicacionFinca } from '../lib/fincas'
import type { ReferenciaSigpac } from '../lib/sigpac'
import type { Finca, Recinto, Socio } from '../lib/tipos'

export type Limites = [[number, number], [number, number]]

export interface FincaMapa {
  id: string
  nombre: string
  socio: string
  cultivo: string | null
  campana: string | null
  superficie_ha: number | null
  /** Contornos de los recintos (en grados, [longitud, latitud]). */
  contornos: Geometry[]
  /** Punto donde marcar la finca cuando se ve de lejos o si no tiene contornos: [latitud, longitud]. */
  punto: [number, number] | null
  limites: Limites | null
}

function posiciones(g: Geometry): Position[] {
  if (g.type === 'Polygon') return g.coordinates.flat()
  if (g.type === 'MultiPolygon') return g.coordinates.flat(2)
  if (g.type === 'Point') return [g.coordinates]
  return []
}

/** Rectángulo [[sur, oeste], [norte, este]] que contiene las geometrías (o null si no hay). */
export function limitesDe(geometrias: Geometry[], puntos: [number, number][] = []): Limites | null {
  let s = Infinity
  let o = Infinity
  let n = -Infinity
  let e = -Infinity
  for (const g of geometrias) {
    for (const [lon, lat] of posiciones(g)) {
      s = Math.min(s, lat)
      n = Math.max(n, lat)
      o = Math.min(o, lon)
      e = Math.max(e, lon)
    }
  }
  for (const [lat, lon] of puntos) {
    s = Math.min(s, lat)
    n = Math.max(n, lat)
    o = Math.min(o, lon)
    e = Math.max(e, lon)
  }
  return Number.isFinite(s) ? [[s, o], [n, e]] : null
}

export function prepararFincas(fincas: Finca[], recintos: Recinto[], socios: Socio[]): FincaMapa[] {
  const nombresSocio = new Map(socios.map((s) => [s.id, s.nombre]))
  const porFinca = new Map<string, Recinto[]>()
  for (const r of recintos) porFinca.set(r.finca_id, [...(porFinca.get(r.finca_id) ?? []), r])

  const resultado: FincaMapa[] = []
  for (const f of fincas) {
    const suyos = porFinca.get(f.id) ?? []
    const contornos = suyos.map((r) => r.geometria).filter((g): g is Geometry => g !== null)
    const u = ubicacionFinca(f, suyos)
    const punto: [number, number] | null = u ? [u.latitud, u.longitud] : null
    // Sin contorno ni punto la finca no se puede poner en el mapa.
    if (!contornos.length && !punto) continue
    resultado.push({
      id: f.id,
      nombre: f.nombre,
      socio: nombresSocio.get(f.socio_id) ?? '',
      cultivo: f.cultivo,
      campana: f.campana,
      superficie_ha: f.superficie_ha,
      contornos,
      punto,
      limites: limitesDe(contornos, punto ? [punto] : []),
    })
  }
  return resultado
}

/** Une los límites de varias fincas. */
export function unirLimites(lista: (Limites | null)[]): Limites | null {
  const validos = lista.filter((l): l is Limites => l !== null)
  if (!validos.length) return null
  return [
    [Math.min(...validos.map((l) => l[0][0])), Math.min(...validos.map((l) => l[0][1]))],
    [Math.max(...validos.map((l) => l[1][0])), Math.max(...validos.map((l) => l[1][1]))],
  ]
}

/** Centro de un contorno como [latitud, longitud], para «Cómo llegar». */
export function centroDe(g: Geometry | null): [number, number] | null {
  return centro(g)
}

export interface FincaDeRecinto {
  fincaId: string
  nombre: string
  socio: string
}

/** Fincas que ya tienen este recinto SIGPAC (puede haber más de una). */
export async function fincasDeRecinto(r: Pick<ReferenciaSigpac, 'provincia' | 'municipio' | 'poligono' | 'parcela'> & { recinto: number | null }): Promise<FincaDeRecinto[]> {
  const candidatos = await db.recintos.where('[municipio+poligono+parcela]').equals([r.municipio, r.poligono, r.parcela]).toArray()
  const iguales = candidatos.filter((c) => c.provincia === r.provincia && (r.recinto === null || c.recinto === r.recinto))
  const encontradas: FincaDeRecinto[] = []
  const vistas = new Set<string>()
  for (const c of iguales) {
    if (vistas.has(c.finca_id)) continue
    vistas.add(c.finca_id)
    const finca = await db.fincas.get(c.finca_id)
    if (!finca) continue
    const socio = await db.socios.get(finca.socio_id)
    encontradas.push({ fincaId: finca.id, nombre: finca.nombre, socio: socio?.nombre ?? '' })
  }
  return encontradas
}
