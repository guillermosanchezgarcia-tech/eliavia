// Cálculos sencillos con los contornos de los recintos (GeoJSON en grados).

import type { Geometry, Position } from 'geojson'

/** Anillos exteriores de un polígono o multipolígono. */
function anillosExteriores(g: Geometry): Position[][] {
  if (g.type === 'Polygon') return g.coordinates.slice(0, 1)
  if (g.type === 'MultiPolygon') return g.coordinates.map((p) => p[0])
  return []
}

/** Redondea las coordenadas (6 decimales ≈ 10 cm) para ocupar menos. */
export function redondearGeometria<G extends Geometry>(g: G, decimales = 6): G {
  const f = 10 ** decimales
  const r = (c: unknown): unknown =>
    Array.isArray(c) ? (typeof c[0] === 'number' ? c.map((n: number) => Math.round(n * f) / f) : c.map(r)) : c
  return 'coordinates' in g ? ({ ...g, coordinates: r(g.coordinates) } as G) : g
}

/** Centro del contorno (centroide por áreas). Devuelve [latitud, longitud]. */
export function centro(g: Geometry | null | undefined): [number, number] | null {
  if (!g) return null
  let area = 0
  let cx = 0
  let cy = 0
  let n = 0
  let sx = 0
  let sy = 0
  for (const anillo of anillosExteriores(g)) {
    for (let i = 0; i < anillo.length - 1; i++) {
      const [x0, y0] = anillo[i]
      const [x1, y1] = anillo[i + 1]
      const cruz = x0 * y1 - x1 * y0
      area += cruz
      cx += (x0 + x1) * cruz
      cy += (y0 + y1) * cruz
      sx += x0
      sy += y0
      n++
    }
  }
  if (!n) return null
  if (Math.abs(area) < 1e-14) return [sy / n, sx / n]
  return [cy / (3 * area), cx / (3 * area)]
}

/**
 * Silueta del contorno como camino SVG dentro de un cuadro de `lado` × `lado`,
 * para dibujar la forma del recinto en pequeño.
 */
export function silueta(g: Geometry | null | undefined, lado = 100, margen = 6): string | null {
  if (!g) return null
  const anillos = anillosExteriores(g)
  const puntos = anillos.flat()
  if (puntos.length < 3) return null
  const latMedia = puntos.reduce((s, p) => s + p[1], 0) / puntos.length
  const kx = Math.cos((latMedia * Math.PI) / 180)
  const xs = puntos.map((p) => p[0] * kx)
  const ys = puntos.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxY = Math.max(...ys)
  const ancho = Math.max(...xs) - minX
  const alto = maxY - Math.min(...ys)
  const escala = (lado - 2 * margen) / Math.max(ancho, alto, 1e-12)
  const dx = margen + (lado - 2 * margen - ancho * escala) / 2
  const dy = margen + (lado - 2 * margen - alto * escala) / 2
  return anillos
    .map(
      (anillo) =>
        anillo
          .map((p, i) => {
            const x = (p[0] * kx - minX) * escala + dx
            const y = (maxY - p[1]) * escala + dy
            return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
          })
          .join('') + 'Z',
    )
    .join('')
}

/** Coordenadas de un polígono en el orden que usa Leaflet: [latitud, longitud]. */
export function latLngsDe(g: Geometry | null | undefined): [number, number][][] | [number, number][][][] | null {
  if (!g) return null
  const anillo = (r: Position[]) => r.map(([lon, lat]) => [lat, lon] as [number, number])
  if (g.type === 'Polygon') return g.coordinates.map(anillo)
  if (g.type === 'MultiPolygon') return g.coordinates.map((p) => p.map(anillo))
  return null
}
