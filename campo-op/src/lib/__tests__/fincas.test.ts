import type { Geometry } from 'geojson'
import { describe, expect, it } from 'vitest'
import { campanaDe, campanasRecientes } from '../catalogos'
import { numeroParaCampo, parsearNumero } from '../formato'
import { centro, redondearGeometria, silueta } from '../geometria'
import { codigoReferencia, nombreMunicipio, textoReferencia } from '../sigpac'
import { descripcionTipo, enlaceComoLlegar, filtrarFincas, SIN_VALOR, sumaSuperficies, ubicacionFinca } from '../fincas'
import type { Finca } from '../tipos'

describe('números a la española', () => {
  it('lee decimales con coma o punto y miles con punto', () => {
    expect(parsearNumero('1,2345')).toBe(1.2345)
    expect(parsearNumero('1.234,5')).toBe(1234.5)
    expect(parsearNumero('12000')).toBe(12000)
    expect(parsearNumero(' 0.5 ')).toBe(0.5)
  })

  it('rechaza lo que no es un número', () => {
    expect(parsearNumero('')).toBeNull()
    expect(parsearNumero('abc')).toBeNull()
    expect(parsearNumero('1,2,3')).toBeNull()
    expect(parsearNumero('12 ha')).toBeNull()
  })

  it('escribe números para los campos', () => {
    expect(numeroParaCampo(1.2345)).toBe('1,2345')
    expect(numeroParaCampo(2)).toBe('2')
    expect(numeroParaCampo(0.30000000000000004)).toBe('0,3')
    expect(numeroParaCampo(null)).toBe('')
  })
})

describe('campaña agrícola', () => {
  it('empieza en septiembre', () => {
    expect(campanaDe(new Date(2026, 7, 31))).toBe('2025/2026')
    expect(campanaDe(new Date(2026, 8, 1))).toBe('2026/2027')
    expect(campanaDe(new Date(2027, 2, 15))).toBe('2026/2027')
  })

  it('ofrece la siguiente, la actual y dos anteriores', () => {
    expect(campanasRecientes(new Date(2026, 9, 7))).toEqual(['2027/2028', '2026/2027', '2025/2026', '2024/2025'])
  })
})

describe('referencia SIGPAC', () => {
  const ref = { provincia: 4, municipio: 104, agregado: 0, zona: 0, poligono: 23, parcela: 372, recinto: 3 }

  it('da el formato oficial y el texto corto', () => {
    expect(codigoReferencia(ref)).toBe('04:104:0:0:23:372:3')
    expect(codigoReferencia({ ...ref, recinto: null })).toBe('04:104:0:0:23:372')
    expect(textoReferencia(ref)).toBe('Pol. 23 · Parc. 372 · Rec. 3')
    expect(textoReferencia({ ...ref, recinto: null })).toBe('Pol. 23 · Parc. 372')
  })

  it('sabe el nombre de los municipios de Almería', () => {
    expect(nombreMunicipio(4, 104)).toBe('El Ejido')
    expect(nombreMunicipio(4, 66)).toBe('Níjar')
    expect(nombreMunicipio(4, 9999)).toBe('Municipio 9999')
    expect(nombreMunicipio(4, null)).toBe('')
  })
})

describe('contornos', () => {
  const cuadrado: Geometry = {
    type: 'Polygon',
    coordinates: [[[-2.74, 36.73], [-2.73, 36.73], [-2.73, 36.74], [-2.74, 36.74], [-2.74, 36.73]]],
  }

  it('calcula el centro', () => {
    const [lat, lon] = centro(cuadrado)!
    expect(lat).toBeCloseTo(36.735, 6)
    expect(lon).toBeCloseTo(-2.735, 6)
    expect(centro(null)).toBeNull()
  })

  it('dibuja la silueta dentro del cuadro', () => {
    const d = silueta(cuadrado, 100, 6)!
    expect(d.startsWith('M')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
    const numeros = d.match(/-?\d+(\.\d+)?/g)!.map(Number)
    expect(Math.min(...numeros)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...numeros)).toBeLessThanOrEqual(100)
    expect(silueta(null)).toBeNull()
  })

  it('redondea las coordenadas', () => {
    const g = redondearGeometria({ type: 'Point', coordinates: [-2.7366666666, 36.7380000009] } as Geometry, 6)
    expect(g).toEqual({ type: 'Point', coordinates: [-2.736667, 36.738] })
  })
})

function finca(extra: Partial<Finca>): Finca {
  return {
    id: crypto.randomUUID(),
    socio_id: 's1',
    nombre: 'Finca',
    provincia: 4,
    municipio: 104,
    tipo: null,
    tipo_invernadero: null,
    tipo_invernadero_otro: null,
    superficie_ha: null,
    cultivo: null,
    campana: null,
    latitud: null,
    longitud: null,
    certificaciones: [],
    observaciones: null,
    fecha_ultima_visita: null,
    eliminado: false,
    created_at: '',
    created_by: null,
    updated_at: '',
    updated_by: null,
    ...extra,
  }
}

describe('filtrar fincas', () => {
  const a = finca({ nombre: 'La Loma', socio_id: 's1', cultivo: 'Tomate', tipo: 'invernadero', superficie_ha: 1.5, certificaciones: ['GlobalG.A.P.'] })
  const b = finca({ nombre: 'El Cerro', socio_id: 's2', cultivo: 'Pimiento', tipo: 'aire_libre', superficie_ha: 4, municipio: 66 })
  const c = finca({ nombre: 'Balsa', socio_id: 's1', cultivo: 'Tomate', superficie_ha: null })
  const textos = new Map([
    [a.id, 'La Loma Tomate Pérez El Ejido'],
    [b.id, 'El Cerro Pimiento López Níjar'],
    [c.id, 'Balsa Tomate Pérez El Ejido'],
  ])
  const socios = new Map<string, { nombre: string; estado: 'activo' | 'baja' }>([
    ['s1', { nombre: 'Pérez', estado: 'activo' }],
    ['s2', { nombre: 'López', estado: 'baja' }],
  ])
  const base = { busqueda: '', socio: '', tipo: '', cultivo: '', municipio: '', certificacion: '', campana: '', soloActivos: false, orden: 'nombre' as const }
  const nombres = (l: Finca[]) => l.map((f) => f.nombre)

  it('ordena por nombre, socio o superficie', () => {
    const todas = [a, b, c]
    expect(nombres(filtrarFincas(todas, textos, socios, base))).toEqual(['Balsa', 'El Cerro', 'La Loma'])
    expect(nombres(filtrarFincas(todas, textos, socios, { ...base, orden: 'socio' }))).toEqual(['El Cerro', 'Balsa', 'La Loma'])
    expect(nombres(filtrarFincas(todas, textos, socios, { ...base, orden: 'superficie' }))).toEqual(['El Cerro', 'La Loma', 'Balsa'])
  })

  it('filtra por cada criterio y por varios a la vez', () => {
    const todas = [a, b, c]
    expect(nombres(filtrarFincas(todas, textos, socios, { ...base, socio: 's1' }))).toEqual(['Balsa', 'La Loma'])
    expect(nombres(filtrarFincas(todas, textos, socios, { ...base, tipo: 'aire_libre' }))).toEqual(['El Cerro'])
    expect(nombres(filtrarFincas(todas, textos, socios, { ...base, cultivo: 'Tomate' }))).toEqual(['Balsa', 'La Loma'])
    expect(nombres(filtrarFincas(todas, textos, socios, { ...base, municipio: '4:66' }))).toEqual(['El Cerro'])
    expect(nombres(filtrarFincas(todas, textos, socios, { ...base, certificacion: 'GlobalG.A.P.' }))).toEqual(['La Loma'])
    expect(nombres(filtrarFincas(todas, textos, socios, { ...base, cultivo: 'Tomate', tipo: 'invernadero' }))).toEqual(['La Loma'])
  })

  it('filtra sin fijarse en mayúsculas ni tildes', () => {
    const d = finca({ nombre: 'Dos', socio_id: 's1', cultivo: 'tómate', certificaciones: ['globalg.a.p.'] })
    const todas = [a, b, c, d]
    expect(nombres(filtrarFincas(todas, textos, socios, { ...base, cultivo: 'TOMATE' }))).toEqual(['Balsa', 'Dos', 'La Loma'])
    expect(nombres(filtrarFincas(todas, textos, socios, { ...base, certificacion: 'GlobalG.A.P.' }))).toEqual(['Dos', 'La Loma'])
  })

  it('filtra por campaña, por «sin dato» y por socios activos', () => {
    const d = finca({ nombre: 'Dos', socio_id: 's1', campana: '2025/2026' })
    const todas = [a, b, c, d]
    expect(nombres(filtrarFincas(todas, textos, socios, { ...base, campana: '2025/2026' }))).toEqual(['Dos'])
    expect(nombres(filtrarFincas(todas, textos, socios, { ...base, campana: SIN_VALOR }))).toEqual(['Balsa', 'El Cerro', 'La Loma'])
    expect(nombres(filtrarFincas(todas, textos, socios, { ...base, cultivo: SIN_VALOR }))).toEqual(['Dos'])
    expect(nombres(filtrarFincas(todas, textos, socios, { ...base, certificacion: SIN_VALOR }))).toEqual(['Balsa', 'Dos', 'El Cerro'])
    expect(nombres(filtrarFincas(todas, textos, socios, { ...base, tipo: SIN_VALOR }))).toEqual(['Balsa', 'Dos'])
    // el socio s2 está de baja: su finca «El Cerro» queda fuera
    expect(nombres(filtrarFincas(todas, textos, socios, { ...base, soloActivos: true }))).toEqual(['Balsa', 'Dos', 'La Loma'])
  })

  it('busca sin tildes y por varias palabras', () => {
    expect(nombres(filtrarFincas([a, b, c], textos, socios, { ...base, busqueda: 'perez ejido' }))).toEqual(['Balsa', 'La Loma'])
    expect(nombres(filtrarFincas([a, b, c], textos, socios, { ...base, busqueda: 'nijar' }))).toEqual(['El Cerro'])
  })
})

describe('datos de una finca', () => {
  it('describe el tipo', () => {
    expect(descripcionTipo({ tipo: null, tipo_invernadero: null, tipo_invernadero_otro: null })).toBe('')
    expect(descripcionTipo({ tipo: 'aire_libre', tipo_invernadero: null, tipo_invernadero_otro: null })).toBe('Aire libre')
    expect(descripcionTipo({ tipo: 'invernadero', tipo_invernadero: 'multitunel', tipo_invernadero_otro: null })).toBe('Invernadero multitúnel')
    expect(descripcionTipo({ tipo: 'invernadero', tipo_invernadero: 'otro', tipo_invernadero_otro: 'Venlo' })).toBe('Invernadero venlo')
    expect(descripcionTipo({ tipo: 'invernadero', tipo_invernadero: null, tipo_invernadero_otro: null })).toBe('Invernadero')
  })

  it('suma superficies ignorando los recintos sin dato', () => {
    expect(sumaSuperficies([{ superficie_ha: 0.1 }, { superficie_ha: 0.2 }])).toBe(0.3)
    expect(sumaSuperficies([{ superficie_ha: null }])).toBeNull()
    expect(sumaSuperficies([])).toBeNull()
  })

  it('ubica la finca por su GPS o, si no, por un recinto', () => {
    const cuadrado: Geometry = {
      type: 'Polygon',
      coordinates: [[[-2.74, 36.73], [-2.73, 36.73], [-2.73, 36.74], [-2.74, 36.74], [-2.74, 36.73]]],
    }
    expect(ubicacionFinca({ latitud: 36.5, longitud: -2.5 }, [{ geometria: cuadrado }])).toEqual({ latitud: 36.5, longitud: -2.5, origen: 'gps' })
    const u = ubicacionFinca({ latitud: null, longitud: null }, [{ geometria: null }, { geometria: cuadrado }])!
    expect(u.origen).toBe('recinto')
    expect(u.latitud).toBeCloseTo(36.735, 6)
    expect(ubicacionFinca({ latitud: null, longitud: null }, [])).toBeNull()
  })

  it('crea el enlace de Google Maps para llegar', () => {
    expect(enlaceComoLlegar({ latitud: 36.738, longitud: -2.7366 })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=36.738000,-2.736600&travelmode=driving',
    )
  })
})
