import type { Geometry } from 'geojson'

// Tipos de datos de la app. Reflejan las tablas de supabase/01_esquema.sql:
// si se añade un campo allí, se añade también aquí.

export type Rol = 'admin' | 'tecnico'

export interface Perfil {
  id: string
  email: string
  nombre: string | null
  rol: Rol
  activo: boolean
  created_at: string
  updated_at: string
}

/** Campos que comparten socios, fincas, recintos y fotos. */
interface Registro {
  id: string
  eliminado: boolean
  created_at: string
  created_by: string | null
  updated_at: string
  updated_by: string | null
}

export interface Socio extends Registro {
  codigo: string
  nombre: string
  nif: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  codigo_postal: string | null
  localidad: string | null
  fecha_alta: string | null
  estado: 'activo' | 'baja'
  fecha_baja: string | null
  observaciones: string | null
}

export type TipoFinca = 'invernadero' | 'aire_libre'
export type TipoInvernadero = 'raspa_amagado' | 'multitunel' | 'plano' | 'otro'

export interface Finca extends Registro {
  socio_id: string
  nombre: string
  provincia: number
  municipio: number | null
  tipo: TipoFinca | null
  tipo_invernadero: TipoInvernadero | null
  tipo_invernadero_otro: string | null
  superficie_ha: number | null
  cultivo: string | null
  campana: string | null
  latitud: number | null
  longitud: number | null
  certificaciones: string[]
  observaciones: string | null
  fecha_ultima_visita: string | null
}

export interface Recinto extends Registro {
  finca_id: string
  provincia: number
  municipio: number
  agregado: number
  zona: number
  poligono: number
  parcela: number
  recinto: number | null
  superficie_ha: number | null
  uso_sigpac: string | null
  geometria: Geometry | null
}

export interface Foto extends Registro {
  finca_id: string
  ruta: string
  descripcion: string | null
  tomada_en: string | null
}

export const NOMBRES_ROL: Record<Rol, string> = {
  admin: 'Administrador',
  tecnico: 'Técnico',
}
