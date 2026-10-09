// Contenido de los archivos de Excel (.xlsx): qué hojas y qué columnas lleva cada uno.
// Aquí solo se prepara la tabla; el archivo en sí lo crea `descargar.ts`.

import type { Cell } from 'write-excel-file/browser'
import { NOMBRES_TIPO_FINCA } from './catalogos'
import { descripcionTipo } from './fincas'
import {
  DIMENSIONES_INFORME,
  etiquetaMunicipio,
  NOMBRES_DIMENSION,
  resumenDe,
  totalesPor,
  type DimensionInforme,
  type FiltrosInforme,
} from './informes'
import { comparar, formatearFechaHora, HA_A_M2 } from './formato'
import { SIN_VALOR } from './fincas'
import type { Finca, Socio } from './tipos'

/** Una hoja del archivo. Es compatible con la que espera la librería de Excel. */
export interface HojaExcel {
  sheet: string
  data: Cell[][]
  columns?: { width: number }[]
  stickyRowsCount?: number
}

const VERDE = '#15803d'
const FORMATO_HA = '#,##0.00'
const FORMATO_HA_4 = '#,##0.0000'
const FORMATO_ENTERO = '#,##0'
const FORMATO_PORCENTAJE = '0.0%'
const FORMATO_FECHA = 'dd/mm/yyyy'
/** Fuerza a Excel a tratarlo como texto (códigos con ceros delante, teléfonos, NIF…). */
const TEXTO = '@'

const cab = (value: string, align: 'left' | 'right' = 'left'): Cell => ({
  value,
  fontWeight: 'bold',
  textColor: '#ffffff',
  backgroundColor: VERDE,
  alignVertical: 'center',
  align,
  wrap: true,
})
const negrita = (value: string | number, format?: string): Cell => ({ value, fontWeight: 'bold', ...(format ? { format } : {}) })
const texto = (value: string | null | undefined, format?: string): Cell => (value ? { value, ...(format ? { format } : {}) } : null)
const numero = (value: number | null | undefined, format: string): Cell => (value === null || value === undefined ? null : { value, format })

/** Fecha «AAAA-MM-DD» como fecha de Excel (a medianoche UTC, que es como la lee la librería). */
const fecha = (iso: string | null | undefined): Cell => {
  if (!iso) return null
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : { value: d, format: FORMATO_FECHA }
}

/** Las hojas de Excel no admiten ciertos signos ni más de 31 caracteres en el nombre. */
export function nombreDeHoja(nombre: string): string {
  return nombre.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31)
}

/** Para el nombre del archivo: «Informe Cooperativa Poniente» → «informe-cooperativa-poniente». */
export function nombreDeArchivo(...partes: string[]): string {
  return partes
    .join(' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface DatosInforme {
  fincas: Finca[]
  socios: Pick<Socio, 'id' | 'codigo' | 'nombre'>[]
  filtros: FiltrosInforme
  /** Nombre de la OP, para el título. */
  organizacion: string
  /** Quién lo genera. */
  autor: string
  /** Momento de la generación, en ISO (para que se pueda probar). */
  generado: string
}

function hojaResumen(d: DatosInforme): HojaExcel {
  const r = resumenDe(d.fincas)
  const campana = d.filtros.campana === SIN_VALOR ? 'Fincas sin campaña' : d.filtros.campana || 'Todas'
  const tipo = d.filtros.tipo === SIN_VALOR ? 'Sin tipo indicado' : (NOMBRES_TIPO_FINCA[d.filtros.tipo as keyof typeof NOMBRES_TIPO_FINCA] ?? 'Todos')
  return {
    sheet: 'Resumen',
    columns: [{ width: 34 }, { width: 34 }],
    data: [
      [{ value: `Informe de ${d.organizacion}`, fontWeight: 'bold', fontSize: 16, textColor: VERDE }],
      [texto(`Generado el ${formatearFechaHora(d.generado)} por ${d.autor}`)],
      [],
      [cab('Filtros aplicados'), cab('')],
      [texto('Campaña'), texto(campana)],
      [texto('Tipo de finca'), texto(tipo)],
      [texto('Socios'), texto(d.filtros.incluirBajas ? 'Activos y de baja' : 'Solo socios activos')],
      [],
      [cab('Totales'), cab('', 'right')],
      [texto('Socios con fincas'), numero(r.socios, FORMATO_ENTERO)],
      [texto('Fincas'), numero(r.fincas, FORMATO_ENTERO)],
      [texto('Superficie (ha)'), numero(r.ha, FORMATO_HA)],
      [texto('Fincas sin superficie indicada'), numero(r.sinSuperficie, FORMATO_ENTERO)],
    ],
  }
}

const NOMBRES_HOJA: Record<DimensionInforme, string> = {
  cultivo: 'Por cultivo',
  municipio: 'Por municipio',
  certificacion: 'Por certificación',
  tipo: 'Por tipo de finca',
}

function hojaTotales(d: DatosInforme, dimension: DimensionInforme): HojaExcel {
  const filas = totalesPor(d.fincas, dimension)
  const total = resumenDe(d.fincas)
  const data: Cell[][] = [
    [cab(NOMBRES_DIMENSION[dimension]), cab('Fincas', 'right'), cab('Socios', 'right'), cab('Superficie (ha)', 'right'), cab('% de la superficie', 'right'), cab('Fincas sin superficie', 'right')],
    ...filas.map((f): Cell[] => [
      texto(f.etiqueta),
      numero(f.fincas, FORMATO_ENTERO),
      numero(f.socios, FORMATO_ENTERO),
      numero(f.ha, FORMATO_HA),
      numero(f.parte, FORMATO_PORCENTAJE),
      numero(f.sinSuperficie, FORMATO_ENTERO),
    ]),
  ]
  if (dimension === 'certificacion') {
    data.push([], [texto('Una finca con varias certificaciones cuenta en cada una de ellas, por eso las filas no suman el total.')])
  } else {
    data.push([negrita('Total'), negrita(total.fincas, FORMATO_ENTERO), negrita(total.socios, FORMATO_ENTERO), negrita(total.ha, FORMATO_HA), null, negrita(total.sinSuperficie, FORMATO_ENTERO)])
  }
  return {
    sheet: nombreDeHoja(NOMBRES_HOJA[dimension]),
    columns: [{ width: 34 }, { width: 10 }, { width: 10 }, { width: 18 }, { width: 20 }, { width: 22 }],
    stickyRowsCount: 1,
    data,
  }
}

/** Una fila por finca, con los datos del socio que la lleva. */
export function hojaFincas(fincas: Finca[], socios: Pick<Socio, 'id' | 'codigo' | 'nombre'>[], nombre = 'Fincas'): HojaExcel {
  const porId = new Map(socios.map((s) => [s.id, s]))
  return {
    sheet: nombreDeHoja(nombre),
    columns: [{ width: 12 }, { width: 30 }, { width: 28 }, { width: 22 }, { width: 28 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 12 }, { width: 30 }, { width: 14 }],
    stickyRowsCount: 1,
    data: [
      [
        cab('Código socio'),
        cab('Socio'),
        cab('Finca'),
        cab('Municipio'),
        cab('Tipo'),
        cab('Superficie (ha)', 'right'),
        cab('Superficie (m²)', 'right'),
        cab('Cultivo'),
        cab('Campaña'),
        cab('Certificaciones'),
        cab('Última visita'),
      ],
      ...fincas.map((f): Cell[] => {
        const socio = porId.get(f.socio_id)
        return [
          texto(socio?.codigo, TEXTO),
          texto(socio?.nombre),
          texto(f.nombre),
          texto(f.municipio === null ? '' : etiquetaMunicipio(f.provincia, f.municipio)),
          texto(descripcionTipo(f)),
          numero(f.superficie_ha, FORMATO_HA_4),
          numero(f.superficie_ha === null ? null : Math.round(f.superficie_ha * HA_A_M2), FORMATO_ENTERO),
          texto(f.cultivo),
          texto(f.campana),
          texto(f.certificaciones.join(', ')),
          fecha(f.fecha_ultima_visita),
        ]
      }),
    ],
  }
}

/** El libro completo del informe: resumen, un total por cada dimensión y el detalle de las fincas. */
export function hojasInforme(d: DatosInforme): HojaExcel[] {
  const orden = [...d.fincas].sort((a, b) => comparar(a.nombre, b.nombre))
  return [hojaResumen(d), ...DIMENSIONES_INFORME.map((x) => hojaTotales(d, x)), hojaFincas(orden, d.socios, 'Detalle de fincas')]
}

/** Lista de socios con sus datos de contacto y lo que llevan en fincas. */
export function hojaSocios(socios: Socio[], fincas: Pick<Finca, 'socio_id' | 'superficie_ha'>[]): HojaExcel {
  const resumen = new Map<string, { n: number; ha: number }>()
  for (const f of fincas) {
    const r = resumen.get(f.socio_id) ?? { n: 0, ha: 0 }
    r.n += 1
    r.ha += f.superficie_ha ?? 0
    resumen.set(f.socio_id, r)
  }
  return {
    sheet: 'Socios',
    columns: [{ width: 12 }, { width: 34 }, { width: 14 }, { width: 14 }, { width: 30 }, { width: 32 }, { width: 10 }, { width: 22 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 16 }, { width: 36 }],
    stickyRowsCount: 1,
    data: [
      [
        cab('Código'),
        cab('Nombre'),
        cab('NIF / CIF'),
        cab('Teléfono'),
        cab('Email'),
        cab('Dirección'),
        cab('C. postal'),
        cab('Localidad'),
        cab('Estado'),
        cab('Fecha de alta'),
        cab('Fecha de baja'),
        cab('Fincas', 'right'),
        cab('Superficie (ha)', 'right'),
        cab('Observaciones'),
      ],
      ...socios.map((s): Cell[] => {
        const r = resumen.get(s.id)
        return [
          texto(s.codigo, TEXTO),
          texto(s.nombre),
          texto(s.nif, TEXTO),
          texto(s.telefono, TEXTO),
          texto(s.email),
          texto(s.direccion),
          texto(s.codigo_postal, TEXTO),
          texto(s.localidad),
          texto(s.estado === 'baja' ? 'De baja' : 'Activo'),
          fecha(s.fecha_alta),
          fecha(s.fecha_baja),
          numero(r?.n ?? 0, FORMATO_ENTERO),
          numero(Math.round((r?.ha ?? 0) * 10000) / 10000, FORMATO_HA),
          texto(s.observaciones),
        ]
      }),
    ],
  }
}
