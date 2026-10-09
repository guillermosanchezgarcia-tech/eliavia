import { describe, expect, it } from 'vitest'
import type { Limites } from '../../mapa/datos'
import {
  ampliar,
  areasDeFincas,
  areasDePantalla,
  formatearBytes,
  MAX_TESELAS,
  planificar,
  rangoTeselas,
  urlOrtofoto,
  urlSigpac,
  ZOOM_MIN_SIGPAC,
} from '../../mapa/teselas'

// Un trozo de invernaderos de Dalías (unos 600 × 450 m).
const DALIAS: Limites = [
  [36.78, -2.87],
  [36.784, -2.863],
]

describe('teselas del mapa', () => {
  it('calcula la tesela de un punto como los mapas web', () => {
    // Madrid (Puerta del Sol) en el nivel 10 es la columna 501, fila 386.
    const r = rangoTeselas([[40.4168, -3.7038], [40.4168, -3.7038]], 10)
    expect([r.xMin, r.yMin]).toEqual([501, 386])
    expect(r.xMax).toBe(r.xMin)
    expect(r.yMax).toBe(r.yMin)
  })

  it('pone el norte arriba (fila menor) y el sur abajo', () => {
    const r = rangoTeselas(DALIAS, 17)
    expect(r.yMin).toBeLessThanOrEqual(r.yMax)
    expect(r.xMin).toBeLessThanOrEqual(r.xMax)
  })

  it('construye las direcciones del PNOA y del SIGPAC', () => {
    expect(urlOrtofoto({ z: 17, x: 64491, y: 51638 })).toContain('TileMatrix=17&TileRow=51638&TileCol=64491')
    const sigpac = urlSigpac({ z: 0, x: 0, y: 0 })
    // La tesela 0/0/0 es el mundo entero en EPSG:3857.
    expect(sigpac).toContain('bbox=-20037508.34,-20037508.34,20037508.34,20037508.34')
    expect(sigpac).toContain('crs=EPSG:3857')
    expect(new URL(sigpac).pathname).toBe('/wms')
  })

  it('no descarga la capa SIGPAC de lejos', () => {
    const plan = planificar(areasDePantalla(DALIAS, 18))
    expect(plan.ortofoto.some((t) => t.z === 10)).toBe(true)
    expect(plan.sigpac.every((t) => t.z >= ZOOM_MIN_SIGPAC)).toBe(true)
    expect(plan.total).toBe(plan.ortofoto.length + plan.sigpac.length)
    expect(plan.ortofoto.every((t) => t.z <= 18)).toBe(true)
  })

  it('más detalle son más imágenes (unas cuatro veces por nivel)', () => {
    const n18 = planificar(areasDePantalla(DALIAS, 18)).total
    const n19 = planificar(areasDePantalla(DALIAS, 19)).total
    expect(n19).toBeGreaterThan(n18 * 2)
  })

  it('no repite teselas que comparten dos fincas vecinas', () => {
    const una = planificar(areasDeFincas([DALIAS], 18)).total
    const dos = planificar(areasDeFincas([DALIAS, DALIAS], 18)).total
    expect(dos).toBe(una)
  })

  it('se para y avisa si la zona es enorme', () => {
    const provincia: Limites = [[36.6, -3.2], [37.6, -1.6]]
    const plan = planificar(areasDePantalla(provincia, 19))
    expect(plan.total).toBeGreaterThan(MAX_TESELAS)
    expect(plan.total).toBeLessThanOrEqual(MAX_TESELAS + 2)
  })

  it('una finca suelta a detalle normal cabe de sobra', () => {
    const plan = planificar(areasDeFincas([DALIAS], 18))
    expect(plan.total).toBeLessThan(1000)
    expect(plan.bytesEstimados).toBeLessThan(20_000_000)
  })

  it('amplía un rectángulo unos metros por cada lado', () => {
    const [[s, o], [n, e]] = ampliar(DALIAS, 111.32)
    expect(s).toBeCloseTo(36.779, 4)
    expect(n).toBeCloseTo(36.785, 4)
    expect(o).toBeLessThan(-2.87)
    expect(e).toBeGreaterThan(-2.863)
  })

  it('sin fincas no hay nada que descargar', () => {
    expect(areasDeFincas([], 18)).toEqual([])
  })

  it('escribe los tamaños en español', () => {
    expect(formatearBytes(850)).toBe('850 B')
    expect(formatearBytes(12_400)).toBe('12 kB')
    expect(formatearBytes(4_560_000)).toBe('4,6 MB')
    expect(formatearBytes(123_000_000)).toBe('123 MB')
    expect(formatearBytes(1_500_000_000)).toBe('1,5 GB')
  })
})
