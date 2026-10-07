// Base de datos DENTRO del móvil (IndexedDB, a través de la librería Dexie).
//
// La app siempre lee y escribe aquí, haya cobertura o no. Cada cambio se
// apunta además en «pendientes», una lista de cosas por enviar a Supabase.
// El motor de sincronización (sincronizacion.ts) envía esos pendientes y
// descarga lo que hayan cambiado los demás.

import Dexie, { type EntityTable } from 'dexie'
import type { Finca, Foto, Perfil, Recinto, Socio } from '../lib/tipos'

/** Tablas que se copian en el móvil y se sincronizan en los dos sentidos. */
export const TABLAS = ['socios', 'fincas', 'recintos', 'fotos'] as const
export type Tabla = (typeof TABLAS)[number]

export interface FilasPorTabla {
  socios: Socio
  fincas: Finca
  recintos: Recinto
  fotos: Foto
}

/** Un cambio hecho en el móvil que todavía no ha llegado a Supabase. */
export interface Pendiente {
  num?: number
  tabla: Tabla
  fila_id: string
  operacion: 'crear' | 'modificar'
  cambios: Record<string, unknown>
  creado: string
  intentos: number
  /** Si Supabase lo rechazó (p. ej. código repetido), el motivo. */
  error: string | null
}

export interface Ajuste {
  clave: string
  valor: unknown
}

export const db = new Dexie('campo-op') as Dexie & {
  socios: EntityTable<Socio, 'id'>
  fincas: EntityTable<Finca, 'id'>
  recintos: EntityTable<Recinto, 'id'>
  fotos: EntityTable<Foto, 'id'>
  perfiles: EntityTable<Perfil, 'id'>
  pendientes: EntityTable<Pendiente, 'num'>
  ajustes: EntityTable<Ajuste, 'clave'>
}

// Solo se declaran los campos por los que se busca; el resto se guarda igual.
db.version(1).stores({
  socios: 'id, codigo, nombre, estado',
  fincas: 'id, socio_id, municipio, cultivo, tipo',
  recintos: 'id, finca_id, [municipio+poligono+parcela]',
  fotos: 'id, finca_id',
  perfiles: 'id',
  pendientes: '++num, tabla, [tabla+fila_id]',
  ajustes: 'clave',
})

/** Campos que se pueden enviar a Supabase. El resto (fechas de creación,
 *  autor…) los rellena el propio servidor. */
export const CAMPOS_EDITABLES: { [T in Tabla]: (keyof FilasPorTabla[T])[] } = {
  socios: [
    'codigo', 'nombre', 'nif', 'telefono', 'email', 'direccion', 'codigo_postal', 'localidad',
    'fecha_alta', 'estado', 'fecha_baja', 'observaciones', 'eliminado',
  ],
  fincas: [
    'socio_id', 'nombre', 'provincia', 'municipio', 'tipo', 'tipo_invernadero', 'tipo_invernadero_otro',
    'superficie_ha', 'cultivo', 'campana', 'latitud', 'longitud', 'certificaciones', 'observaciones',
    'fecha_ultima_visita', 'eliminado',
  ],
  recintos: [
    'finca_id', 'provincia', 'municipio', 'agregado', 'zona', 'poligono', 'parcela', 'recinto',
    'superficie_ha', 'uso_sigpac', 'geometria', 'eliminado',
  ],
  fotos: ['finca_id', 'ruta', 'descripcion', 'tomada_en', 'eliminado'],
}

export async function leerAjuste<T>(clave: string): Promise<T | undefined> {
  return (await db.ajustes.get(clave))?.valor as T | undefined
}

export async function guardarAjuste(clave: string, valor: unknown) {
  await db.ajustes.put({ clave, valor })
}

/** Borra todos los datos guardados en el móvil (al cerrar sesión). */
export async function vaciarDatosLocales() {
  await db.transaction('rw', [db.socios, db.fincas, db.recintos, db.fotos, db.perfiles, db.pendientes, db.ajustes], async () => {
    await Promise.all([
      db.socios.clear(),
      db.fincas.clear(),
      db.recintos.clear(),
      db.fotos.clear(),
      db.perfiles.clear(),
      db.pendientes.clear(),
      db.ajustes.clear(),
    ])
  })
}
