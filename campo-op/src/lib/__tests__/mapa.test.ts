import type { Geometry } from 'geojson'
import { describe, expect, it } from 'vitest'
import { limitesDe, prepararFincas, unirLimites } from '../../mapa/datos'
import { construirTextos, criteriosDeParametros, hayFiltros } from '../fincas'
import { latLngsDe } from '../geometria'
import type { Finca, Recinto, Socio } from '../tipos'

// Se redondea para que -2,74 + 0,01 sea exactamente -2,73 (en coma flotante no lo es).
const r6 = (n: number) => Math.round(n * 1e6) / 1e6
const cuadrado = (lon: number, lat: number, lado = 0.01): Geometry => ({
  type: 'Polygon',
  coordinates: [[[lon, lat], [r6(lon + lado), lat], [r6(lon + lado), r6(lat + lado)], [lon, r6(lat + lado)], [lon, lat]]],
})

function finca(extra: Partial<Finca>): Finca {
  return {
    id: 'f1', socio_id: 's1', nombre: 'La Loma', provincia: 4, municipio: 104, tipo: 'invernadero',
    tipo_invernadero: null, tipo_invernadero_otro: null, superficie_ha: 1, cultivo: 'Tomate', campana: '2026/2027',
    latitud: null, longitud: null, certificaciones: ['GlobalG.A.P.'], observaciones: null, fecha_ultima_visita: null,
    eliminado: false, created_at: '', created_by: null, updated_at: '', updated_by: null, ...extra,
  }
}
function recinto(extra: Partial<Recinto>): Recinto {
  return {
    id: 'r1', finca_id: 'f1', provincia: 4, municipio: 104, agregado: 0, zona: 0, poligono: 23, parcela: 372, recinto: 3,
    superficie_ha: 1, uso_sigpac: 'IV', geometria: cuadrado(-2.74, 36.73), eliminado: false, created_at: '',
    created_by: null, updated_at: '', updated_by: null, ...extra,
  }
}
const socio = { id: 's1', nombre: 'Agrícola Pérez SL', codigo: '0001' } as Socio

describe('contornos para Leaflet', () => {
  it('cambia el orden a [latitud, longitud]', () => {
    expect(latLngsDe(cuadrado(-2.74, 36.73))).toEqual([[[36.73, -2.74], [36.73, -2.73], [36.74, -2.73], [36.74, -2.74], [36.73, -2.74]]])
  })
  it('acepta multipolígonos y descarta lo que no es un polígono', () => {
    const multi: Geometry = { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]], [[[5, 5], [6, 5], [6, 6], [5, 5]]]] }
    expect(latLngsDe(multi)).toHaveLength(2)
    expect(latLngsDe({ type: 'Point', coordinates: [0, 0] })).toBeNull()
    expect(latLngsDe(null)).toBeNull()
  })
})

describe('límites del mapa', () => {
  it('calcula el rectángulo que contiene contornos y puntos', () => {
    expect(limitesDe([cuadrado(-2.74, 36.73)])).toEqual([[36.73, -2.74], [36.74, -2.73]])
    expect(limitesDe([cuadrado(-2.74, 36.73)], [[36.9, -2.5]])).toEqual([[36.73, -2.74], [36.9, -2.5]])
    expect(limitesDe([])).toBeNull()
  })
  it('une los límites de varias fincas e ignora las que no tienen', () => {
    expect(unirLimites([[[1, 1], [2, 2]], null, [[0, 3], [1.5, 4]]])).toEqual([[0, 1], [2, 4]])
    expect(unirLimites([null])).toBeNull()
  })
})

describe('fincas en el mapa', () => {
  it('usa los contornos de los recintos y el punto de la finca', () => {
    const [f] = prepararFincas([finca({})], [recinto({})], [socio])
    expect(f.socio).toBe('Agrícola Pérez SL')
    expect(f.contornos).toHaveLength(1)
    expect(f.punto![0]).toBeCloseTo(36.735, 6)
    expect(f.limites).toEqual([[36.73, -2.74], [36.74, -2.73]])
  })

  it('pone en el mapa las fincas que solo tienen punto GPS', () => {
    const [f] = prepararFincas([finca({ latitud: 36.5, longitud: -2.5 })], [], [socio])
    expect(f.contornos).toEqual([])
    expect(f.punto).toEqual([36.5, -2.5])
  })

  it('deja fuera las fincas sin ubicación', () => {
    expect(prepararFincas([finca({})], [], [socio])).toEqual([])
    expect(prepararFincas([finca({})], [recinto({ geometria: null })], [socio])).toEqual([])
  })
})

describe('búsqueda y filtros de la dirección', () => {
  it('lee los criterios', () => {
    const c = criteriosDeParametros(new URLSearchParams('q=perez&cultivo=Tomate&tipo=invernadero&orden=superficie&municipio=4:104'))
    expect(c).toEqual({ busqueda: 'perez', socio: '', tipo: 'invernadero', cultivo: 'Tomate', municipio: '4:104', certificacion: '', campana: '', soloActivos: false, orden: 'superficie' })
    expect(criteriosDeParametros(new URLSearchParams('orden=raro')).orden).toBe('nombre')
  })
  it('sabe si hay filtros (el orden no cuenta)', () => {
    expect(hayFiltros(criteriosDeParametros(new URLSearchParams('orden=socio')))).toBe(false)
    expect(hayFiltros(criteriosDeParametros(new URLSearchParams('socio=s1')))).toBe(true)
    expect(hayFiltros(criteriosDeParametros(new URLSearchParams('q=a')))).toBe(true)
  })
  it('construye el texto de búsqueda con socio, municipio y referencias SIGPAC', () => {
    const t = construirTextos([finca({})], [recinto({})], [socio]).get('f1')!
    expect(t).toContain('La Loma')
    expect(t).toContain('Agrícola Pérez SL')
    expect(t).toContain('El Ejido')
    expect(t).toContain('pol 23 parc 372')
    expect(t).toContain('GlobalG.A.P.')
  })
})
