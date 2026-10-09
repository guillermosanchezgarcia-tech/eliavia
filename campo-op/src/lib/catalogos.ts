// Listas de valores fijos con su nombre para mostrar.

import type { TipoFinca, TipoInvernadero } from './tipos'

export const NOMBRES_TIPO_FINCA: Record<TipoFinca, string> = {
  invernadero: 'Invernadero',
  aire_libre: 'Aire libre',
}

export const NOMBRES_TIPO_INVERNADERO: Record<TipoInvernadero, string> = {
  raspa_amagado: 'Raspa y amagado',
  multitunel: 'Multitúnel',
  plano: 'Plano (parral)',
  otro: 'Otro',
}

/** Cultivos que se proponen al escribir. Se puede escribir cualquier otro. */
export const CULTIVOS_HABITUALES = [
  'Tomate',
  'Tomate cherry',
  'Pimiento',
  'Pepino',
  'Calabacín',
  'Berenjena',
  'Judía verde',
  'Melón',
  'Sandía',
  'Lechuga',
  'Brócoli',
  'Coliflor',
  'Col',
  'Alcachofa',
  'Apio',
  'Espárrago',
  'Fresa',
  'Frambuesa',
  'Uva de mesa',
  'Cítricos',
  'Olivo',
  'Almendro',
  'Aguacate',
  'Mango',
  'Papaya',
  'Ornamental',
  'Sin cultivo (barbecho)',
]

/** Certificaciones que se ofrecen para marcar. Se pueden añadir otras. */
export const CERTIFICACIONES_HABITUALES = [
  'GlobalG.A.P.',
  'GRASP',
  'Producción integrada',
  'Agricultura ecológica',
  'LEAF Marque',
  'Tesco Nurture',
  'Residuo cero',
  'Demeter (biodinámica)',
]

/** Nombre de los usos SIGPAC más habituales. */
export const USOS_SIGPAC: Record<string, string> = {
  IV: 'Invernaderos y cultivos bajo plástico',
  TA: 'Tierra arable',
  TH: 'Huerta',
  CI: 'Cítricos',
  FY: 'Frutales',
  FS: 'Frutos secos',
  FL: 'Frutos secos y olivar',
  FV: 'Frutales y viñedo',
  OV: 'Olivar',
  VI: 'Viñedo',
  PA: 'Pasto con arbolado',
  PR: 'Pasto arbustivo',
  PS: 'Pastizal',
  FO: 'Forestal',
  MT: 'Matorral',
  IM: 'Improductivo',
  ED: 'Edificaciones',
  CA: 'Viales',
  AG: 'Corrientes y superficies de agua',
  ZU: 'Zona urbana',
  ZC: 'Zona concentrada',
}

export function nombreUsoSigpac(codigo: string | null | undefined): string {
  if (!codigo) return ''
  return USOS_SIGPAC[codigo] ? `${codigo} · ${USOS_SIGPAC[codigo]}` : codigo
}

/**
 * Campaña agrícola de una fecha. En Almería la campaña hortícola empieza en
 * septiembre: el 15/10/2026 pertenece a la «2026/2027» y el 15/03/2027 también.
 */
export function campanaDe(fecha = new Date()): string {
  const anio = fecha.getFullYear()
  const inicio = fecha.getMonth() >= 8 ? anio : anio - 1
  return `${inicio}/${inicio + 1}`
}

/** Campañas que se ofrecen: las dos anteriores, la actual y la siguiente. */
export function campanasRecientes(fecha = new Date()): string[] {
  const actual = Number(campanaDe(fecha).slice(0, 4))
  return [actual + 1, actual, actual - 1, actual - 2].map((a) => `${a}/${a + 1}`)
}
