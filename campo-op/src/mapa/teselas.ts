// Cuentas de las «teselas» del mapa: los cuadraditos de 256 × 256 píxeles en los
// que se parte cada fondo. Sirven para saber qué hay que descargar para usar
// una zona sin conexión y cuánto va a ocupar.
//
// Las direcciones de las teselas salen SIEMPRE de estas funciones, tanto al
// pintar el mapa como al descargar, para que coincidan al carácter y la app
// encuentre lo descargado.

import type { Limites } from './datos'

export interface Tesela {
  z: number
  x: number
  y: number
}

/** Radio de la Tierra que usan los mapas web (EPSG:3857). */
const R = 6378137
const MEDIO_MUNDO = Math.PI * R

/** PNOA tiene imagen hasta el nivel 19; más cerca se amplía la del 19. */
export const ZOOM_NATIVO = 19
/** Por debajo de este nivel la capa SIGPAC apenas dibuja nada útil: no se descarga. */
export const ZOOM_MIN_SIGPAC = 14
/** Nivel más lejano que se descarga (para ver la comarca entera sin cobertura). */
export const ZOOM_MIN_ZONA = 10
/** Alrededor de las fincas se descarga desde aquí (de lejos ya sirve la vista general). */
export const ZOOM_MIN_FINCAS = 14

/** Límite de teselas por descarga, para no llenar el móvil por error (~400 MB). */
export const MAX_TESELAS = 25000

// Tamaños medios medidos en el Poniente almeriense (zonas de invernaderos).
const BYTES_ORTOFOTO = 14_000
const BYTES_SIGPAC = 9_000

export function urlOrtofoto({ z, x, y }: Tesela): string {
  return (
    'https://www.ign.es/wmts/pnoa-ma?request=GetTile&service=WMTS&VERSION=1.0.0&Layer=OI.OrthoimageCoverage' +
    `&Style=default&Format=image/jpeg&TileMatrixSet=GoogleMapsCompatible&TileMatrix=${z}&TileRow=${y}&TileCol=${x}`
  )
}

export function urlMapaBase({ z, x, y }: Tesela): string {
  return (
    'https://www.ign.es/wmts/ign-base?request=GetTile&service=WMTS&VERSION=1.0.0&Layer=IGNBaseTodo' +
    `&Style=default&Format=image/jpeg&TileMatrixSet=GoogleMapsCompatible&TileMatrix=${z}&TileRow=${y}&TileCol=${x}`
  )
}

/** Recintos SIGPAC del FEGA (servicio WMS): se pide la imagen del rectángulo exacto de la tesela. */
export function urlSigpac({ z, x, y }: Tesela): string {
  const lado = (2 * MEDIO_MUNDO) / 2 ** z
  const oeste = -MEDIO_MUNDO + x * lado
  const norte = MEDIO_MUNDO - y * lado
  const r = (n: number) => Math.round(n * 100) / 100
  const bbox = [r(oeste), r(norte - lado), r(oeste + lado), r(norte)].join(',')
  return (
    'https://sigpac-hubcloud.es/wms?service=WMS&request=GetMap&layers=AU.Sigpac:recinto&styles=' +
    `&format=image/png&transparent=true&version=1.3.0&width=256&height=256&crs=EPSG:3857&bbox=${bbox}`
  )
}

function columna(longitud: number, z: number): number {
  const n = 2 ** z
  return Math.min(n - 1, Math.max(0, Math.floor(((longitud + 180) / 360) * n)))
}

function fila(latitud: number, z: number): number {
  const n = 2 ** z
  const lat = Math.max(-85.0511, Math.min(85.0511, latitud))
  const rad = (lat * Math.PI) / 180
  return Math.min(n - 1, Math.max(0, Math.floor(((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2) * n)))
}

/** Teselas de un nivel que cubren un rectángulo [[sur, oeste], [norte, este]]. */
export function rangoTeselas(limites: Limites, z: number) {
  const [[sur, oeste], [norte, este]] = limites
  return {
    xMin: columna(oeste, z),
    xMax: columna(este, z),
    yMin: fila(norte, z),
    yMax: fila(sur, z),
  }
}

/** Agranda un rectángulo unos metros por cada lado. */
export function ampliar(limites: Limites, metros: number): Limites {
  const [[sur, oeste], [norte, este]] = limites
  const dLat = metros / 111_320
  const latMedia = ((sur + norte) / 2) * (Math.PI / 180)
  const dLon = metros / (111_320 * Math.max(0.1, Math.cos(latMedia)))
  return [
    [sur - dLat, oeste - dLon],
    [norte + dLat, este + dLon],
  ]
}

export interface Area {
  limites: Limites
  zMin: number
  zMax: number
}

export interface Plan {
  ortofoto: Tesela[]
  sigpac: Tesela[]
  total: number
  bytesEstimados: number
}

/**
 * Lista de teselas que hay que descargar para unas áreas (sin repetir las que
 * comparten dos áreas vecinas). Si pasa de `tope`, deja de contar y devuelve
 * `total > tope` para avisar sin colgar el móvil.
 */
export function planificar(areas: Area[], tope = MAX_TESELAS): Plan {
  const vistas = new Set<string>()
  const ortofoto: Tesela[] = []
  const sigpac: Tesela[] = []
  let total = 0
  for (const a of areas) {
    for (let z = a.zMin; z <= Math.min(a.zMax, ZOOM_NATIVO); z++) {
      const { xMin, xMax, yMin, yMax } = rangoTeselas(a.limites, z)
      for (let x = xMin; x <= xMax; x++) {
        for (let y = yMin; y <= yMax; y++) {
          const clave = `${z}/${x}/${y}`
          if (vistas.has(clave)) continue
          vistas.add(clave)
          const t = { z, x, y }
          ortofoto.push(t)
          total++
          if (z >= ZOOM_MIN_SIGPAC) {
            sigpac.push(t)
            total++
          }
          if (total > tope) return { ortofoto, sigpac, total, bytesEstimados: estimar(ortofoto.length, sigpac.length) }
        }
      }
    }
  }
  return { ortofoto, sigpac, total, bytesEstimados: estimar(ortofoto.length, sigpac.length) }
}

function estimar(nOrtofoto: number, nSigpac: number) {
  return nOrtofoto * BYTES_ORTOFOTO + nSigpac * BYTES_SIGPAC
}

/** «12,4 MB», «850 kB»… */
export function formatearBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} kB`
  if (bytes < 1_000_000_000) {
    const mb = bytes / 1_000_000
    return `${mb.toLocaleString('es-ES', { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`
  }
  return `${(bytes / 1_000_000_000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} GB`
}

/** Niveles de detalle que se ofrecen al descargar. */
export const DETALLES = [
  { valor: '17', texto: 'Básico', ayuda: 'Se distinguen los invernaderos y caminos.' },
  { valor: '18', texto: 'Normal', ayuda: 'Recomendado: se ven bien las parcelas y los recintos.' },
  { valor: '19', texto: 'Máximo', ayuda: 'El mayor detalle del PNOA. Ocupa unas cuatro veces más.' },
] as const
export type Detalle = (typeof DETALLES)[number]['valor']

/** Lo que se ve en pantalla, desde la vista de comarca hasta el detalle elegido. */
export function areasDePantalla(limites: Limites, detalle: number): Area[] {
  return [{ limites, zMin: ZOOM_MIN_ZONA, zMax: detalle }]
}

/**
 * Alrededor de cada finca (con un margen para ver los accesos), con detalle;
 * y una vista general de toda la zona de las fincas, sin tanto detalle.
 */
export function areasDeFincas(limitesFincas: Limites[], detalle: number, margen = 150): Area[] {
  if (!limitesFincas.length) return []
  const general: Limites = [
    [Math.min(...limitesFincas.map((l) => l[0][0])), Math.min(...limitesFincas.map((l) => l[0][1]))],
    [Math.max(...limitesFincas.map((l) => l[1][0])), Math.max(...limitesFincas.map((l) => l[1][1]))],
  ]
  return [
    { limites: ampliar(general, 1000), zMin: ZOOM_MIN_ZONA, zMax: ZOOM_MIN_FINCAS - 1 },
    ...limitesFincas.map((l) => ({ limites: ampliar(l, margen), zMin: ZOOM_MIN_FINCAS, zMax: detalle })),
  ]
}
