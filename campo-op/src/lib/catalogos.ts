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
