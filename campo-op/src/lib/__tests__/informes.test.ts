import { describe, expect, it } from 'vitest'
import { SIN_VALOR } from '../fincas'
import {
  fincasDelInforme,
  opcionesDeFiltro,
  redondearHa,
  resumenDe,
  SIN_FILTROS,
  totalesPor,
} from '../informes'
import { hojaFincas, hojasInforme, hojaSocios, nombreDeArchivo, nombreDeHoja } from '../exportar'
import type { Finca, Socio } from '../tipos'

let n = 0
function finca(extra: Partial<Finca>): Finca {
  n += 1
  return {
    id: `f${n}`,
    socio_id: 's1',
    nombre: `Finca ${n}`,
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

function socio(extra: Partial<Socio>): Socio {
  return {
    id: 's1',
    codigo: '001',
    nombre: 'Agrícola Pérez SL',
    nif: 'B04123456',
    telefono: '600123456',
    email: 'perez@ejemplo.es',
    direccion: 'Calle Mayor 1',
    codigo_postal: '04700',
    localidad: 'El Ejido',
    fecha_alta: '2020-01-15',
    estado: 'activo',
    fecha_baja: null,
    observaciones: null,
    eliminado: false,
    created_at: '',
    created_by: null,
    updated_at: '',
    updated_by: null,
    ...extra,
  }
}

const socios = [
  socio({ id: 's1', codigo: '001', nombre: 'Agrícola Pérez SL' }),
  socio({ id: 's2', codigo: '002', nombre: 'José López', estado: 'baja', fecha_baja: '2025-12-31' }),
  socio({ id: 's3', codigo: '003', nombre: 'Marta Ruiz' }),
]

const fincas = [
  finca({ socio_id: 's1', cultivo: 'Tomate', superficie_ha: 1.5, tipo: 'invernadero', campana: '2025/2026', certificaciones: ['GlobalG.A.P.', 'GRASP'] }),
  finca({ socio_id: 's1', cultivo: 'tomate', superficie_ha: 0.3, tipo: 'invernadero', campana: '2025/2026', certificaciones: ['globalg.a.p.'] }),
  finca({ socio_id: 's3', cultivo: 'Tomate ', superficie_ha: 0.2, tipo: 'aire_libre', campana: '2024/2025' }),
  finca({ socio_id: 's3', cultivo: 'Pimiento', superficie_ha: 2, tipo: 'invernadero', municipio: 66, campana: '2025/2026' }),
  finca({ socio_id: 's2', cultivo: 'Pepino', superficie_ha: 10, tipo: 'invernadero', municipio: 66, campana: '2025/2026', certificaciones: ['GRASP'] }),
  finca({ socio_id: 's3', cultivo: null, superficie_ha: null, municipio: null }),
]

describe('hectáreas', () => {
  it('quita los decimales sobrantes de sumar', () => {
    expect(redondearHa(0.1 + 0.2)).toBe(0.3)
  })
})

describe('quién entra en el informe', () => {
  it('por defecto deja fuera a los socios de baja', () => {
    const l = fincasDelInforme(fincas, socios, SIN_FILTROS)
    expect(l).toHaveLength(5)
    expect(l.some((f) => f.socio_id === 's2')).toBe(false)
  })

  it('puede incluir a los de baja', () => {
    expect(fincasDelInforme(fincas, socios, { ...SIN_FILTROS, incluirBajas: true })).toHaveLength(6)
  })

  it('filtra por campaña (sin fijarse en mayúsculas) y por tipo', () => {
    const todas = { ...SIN_FILTROS, incluirBajas: true }
    expect(fincasDelInforme(fincas, socios, { ...todas, campana: '2025/2026' })).toHaveLength(4)
    expect(fincasDelInforme(fincas, socios, { ...todas, campana: SIN_VALOR })).toHaveLength(1)
    expect(fincasDelInforme(fincas, socios, { ...todas, tipo: 'aire_libre' })).toHaveLength(1)
    expect(fincasDelInforme(fincas, socios, { ...todas, tipo: SIN_VALOR })).toHaveLength(1)
    expect(fincasDelInforme(fincas, socios, { ...todas, campana: '2025/2026', tipo: 'invernadero' })).toHaveLength(4)
  })
})

describe('resumen', () => {
  it('cuenta fincas, socios, hectáreas y fincas sin superficie', () => {
    expect(resumenDe(fincas)).toEqual({ socios: 3, fincas: 6, ha: 14, sinSuperficie: 1 })
    expect(resumenDe([])).toEqual({ socios: 0, fincas: 0, ha: 0, sinSuperficie: 0 })
  })
})

describe('totales por cultivo', () => {
  const filas = totalesPor(fincas, 'cultivo')

  it('junta las distintas formas de escribir el mismo cultivo', () => {
    const tomate = filas.find((f) => f.etiqueta === 'Tomate')
    expect(tomate).toMatchObject({ clave: 'Tomate', fincas: 3, socios: 2, ha: 2, sinSuperficie: 0 })
  })

  it('ordena de más a menos hectáreas (si empatan, el que tiene más fincas) y deja «sin cultivo» al final', () => {
    // Tomate y Pimiento suman 2 ha; Tomate va antes porque tiene más fincas.
    expect(filas.map((f) => f.etiqueta)).toEqual(['Pepino', 'Tomate', 'Pimiento', 'Sin cultivo indicado'])
    expect(filas.at(-1)).toMatchObject({ clave: SIN_VALOR, fincas: 1, ha: 0, sinSuperficie: 1 })
  })

  it('calcula la parte de cada uno sobre el total', () => {
    expect(filas[0].parte).toBeCloseTo(10 / 14, 6)
    expect(filas.reduce((s, f) => s + f.parte, 0)).toBeCloseTo(1, 6)
  })

  it('muestra la forma más usada cuando hay varias', () => {
    const l = [
      finca({ cultivo: 'tomate', superficie_ha: 1 }),
      finca({ cultivo: 'Tomate', superficie_ha: 1 }),
      finca({ cultivo: 'Tomate', superficie_ha: 1 }),
      finca({ cultivo: 'TOMATE', superficie_ha: 1 }),
    ]
    expect(totalesPor(l, 'cultivo')[0]).toMatchObject({ etiqueta: 'Tomate', fincas: 4 })
  })

  it('sin fincas no da filas', () => {
    expect(totalesPor([], 'cultivo')).toEqual([])
  })
})

describe('totales por municipio', () => {
  it('usa el nombre del municipio y filtra por su código', () => {
    const filas = totalesPor(fincas, 'municipio')
    expect(filas.map((f) => [f.etiqueta, f.clave, f.fincas])).toEqual([
      ['Níjar', '4:66', 2],
      ['El Ejido', '4:104', 3],
      ['Sin municipio', SIN_VALOR, 1],
    ])
  })

  it('aclara la provincia cuando no es Almería', () => {
    const [fila] = totalesPor([finca({ provincia: 18, municipio: 87, superficie_ha: 1 })], 'municipio')
    expect(fila.etiqueta).toContain('Granada')
    expect(fila.clave).toBe('18:87')
  })
})

describe('totales por certificación', () => {
  const filas = totalesPor(fincas, 'certificacion')

  it('cuenta una finca en cada una de sus certificaciones', () => {
    expect(filas.find((f) => f.etiqueta === 'GlobalG.A.P.')).toMatchObject({ fincas: 2, ha: 1.8 })
    expect(filas.find((f) => f.etiqueta === 'GRASP')).toMatchObject({ fincas: 2, ha: 11.5 })
  })

  it('cuenta aparte las fincas sin certificación', () => {
    expect(filas.at(-1)).toMatchObject({ etiqueta: 'Sin certificación', clave: SIN_VALOR, fincas: 3 })
  })

  it('no cuenta dos veces una certificación repetida en la misma finca', () => {
    const [fila] = totalesPor([finca({ superficie_ha: 1, certificaciones: ['GRASP', 'grasp'] })], 'certificacion')
    expect(fila.fincas).toBe(1)
  })
})

describe('totales por tipo', () => {
  it('separa invernadero, aire libre y sin indicar', () => {
    expect(totalesPor(fincas, 'tipo').map((f) => [f.etiqueta, f.clave, f.fincas])).toEqual([
      ['Invernadero', 'invernadero', 4],
      ['Aire libre', 'aire_libre', 1],
      ['Sin tipo indicado', SIN_VALOR, 1],
    ])
  })
})

describe('valores para los desplegables', () => {
  it('lista los valores por orden alfabético con su número de fincas', () => {
    expect(opcionesDeFiltro(fincas, 'cultivo')).toEqual([
      { valor: 'Pepino', texto: 'Pepino (1)' },
      { valor: 'Pimiento', texto: 'Pimiento (1)' },
      { valor: 'Tomate', texto: 'Tomate (3)' },
      { valor: SIN_VALOR, texto: 'Sin cultivo indicado (1)' },
    ])
  })

  it('lista las campañas de la más reciente a la más antigua, con las fincas sin campaña al final', () => {
    expect(opcionesDeFiltro(fincas, 'campana')).toEqual([
      { valor: '2025/2026', texto: '2025/2026 (4)' },
      { valor: '2024/2025', texto: '2024/2025 (1)' },
      { valor: SIN_VALOR, texto: 'Sin campaña (1)' },
    ])
  })
})

describe('contenido del Excel', () => {
  const datos = {
    fincas: fincasDelInforme(fincas, socios, SIN_FILTROS),
    socios,
    filtros: SIN_FILTROS,
    organizacion: 'OPFH Poniente',
    autor: 'Ana',
    generado: '2026-10-08T10:30:00.000Z',
  }
  const hojas = hojasInforme(datos)
  const celdas = (h: (typeof hojas)[number]) =>
    h.data.map((fila) => fila.map((c) => (c && typeof c === 'object' && 'value' in c ? c.value : c)))

  it('lleva resumen, un total por cada tipo y el detalle de las fincas', () => {
    expect(hojas.map((h) => h.sheet)).toEqual(['Resumen', 'Por cultivo', 'Por municipio', 'Por certificación', 'Por tipo de finca', 'Detalle de fincas'])
  })

  it('el resumen dice qué filtros se aplicaron y los totales', () => {
    const r = celdas(hojas[0]).flat()
    expect(r).toContain('Informe de OPFH Poniente')
    expect(r).toContain('Solo socios activos')
    expect(r).toContain('Todas')
  })

  it('el total por cultivo suma lo mismo que el resumen', () => {
    const filas = celdas(hojas[1])
    expect(filas[0][0]).toBe('Cultivo')
    expect(filas.at(-1)).toEqual(['Total', 5, 2, 4, null, 1])
  })

  it('el detalle lleva una fila por finca con los datos de su socio', () => {
    const detalle = celdas(hojas[5])
    expect(detalle).toHaveLength(1 + datos.fincas.length)
    expect(detalle[0].slice(0, 3)).toEqual(['Código socio', 'Socio', 'Finca'])
    expect(detalle[1].slice(0, 2)).toEqual(['001', 'Agrícola Pérez SL'])
  })

  it('el detalle guarda la superficie en hectáreas y en metros cuadrados', () => {
    const h = hojaFincas([finca({ superficie_ha: 1.2345 })], socios)
    const fila = celdas(h)[1]
    expect(fila[5]).toBe(1.2345)
    expect(fila[6]).toBe(12345)
  })

  it('guarda las fechas como fechas de Excel', () => {
    const h = hojaFincas([finca({ fecha_ultima_visita: '2026-10-07' })], socios)
    const visita = celdas(h)[1][10]
    expect(visita).toBeInstanceOf(Date)
    expect((visita as Date).toISOString()).toBe('2026-10-07T00:00:00.000Z')
  })

  it('la lista de socios incluye contacto y lo que llevan en fincas', () => {
    const h = hojaSocios(socios, fincas)
    const filas = celdas(h)
    expect(filas).toHaveLength(4)
    expect(filas[1].slice(0, 4)).toEqual(['001', 'Agrícola Pérez SL', 'B04123456', '600123456'])
    expect(filas[1].slice(11, 13)).toEqual([2, 1.8])
    expect(filas[2][8]).toBe('De baja')
  })

  it('los nombres de hoja y de archivo son válidos', () => {
    expect(nombreDeHoja('Por [cultivo]: todo/nada?')).not.toMatch(/[[\]:*?/\\]/)
    expect(nombreDeHoja('x'.repeat(50))).toHaveLength(31)
    expect(nombreDeArchivo('Informe', 'OPFH Poniente Ñandú', '2026-10-08')).toBe('informe-opfh-poniente-nandu-2026-10-08')
  })
})
