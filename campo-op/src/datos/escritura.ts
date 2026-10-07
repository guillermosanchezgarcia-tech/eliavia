// Guardar cambios. Todo se escribe primero en el móvil (respuesta inmediata,
// funcione o no la red) y se apunta como pendiente de enviar a Supabase.

import { CAMPOS_EDITABLES, db, type FilasPorTabla, type Tabla } from './db'
import { programarSincronizacion } from './sincronizacion'

let idUsuario: string | null = null

/** Lo llama el motor de sincronización al arrancar, con el usuario de la sesión. */
export function fijarUsuarioActual(id: string | null) {
  idUsuario = id
}

type Datos<T extends Tabla> = Partial<Omit<FilasPorTabla[T], 'id'>>

function soloEditables<T extends Tabla>(tabla: T, datos: Record<string, unknown>) {
  const campos = CAMPOS_EDITABLES[tabla] as string[]
  return Object.fromEntries(Object.entries(datos).filter(([campo]) => campos.includes(campo)))
}

function iguales(a: unknown, b: unknown) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

/** Crea un registro nuevo y devuelve su identificador. */
export async function crear<T extends Tabla>(tabla: T, datos: Datos<T>): Promise<string> {
  const id = crypto.randomUUID()
  const ahora = new Date().toISOString()
  const fila = {
    ...datos,
    id,
    eliminado: false,
    created_at: ahora,
    created_by: idUsuario,
    updated_at: ahora,
    updated_by: idUsuario,
  }
  await db.transaction('rw', db.table(tabla), db.pendientes, async () => {
    await db.table(tabla).add(fila)
    await db.pendientes.add({
      tabla,
      fila_id: id,
      operacion: 'crear',
      cambios: soloEditables(tabla, fila),
      creado: ahora,
      intentos: 0,
      error: null,
    })
  })
  programarSincronizacion()
  return id
}

/** Guarda los campos que hayan cambiado. Devuelve false si no había nada nuevo. */
export async function modificar<T extends Tabla>(tabla: T, id: string, datos: Datos<T>): Promise<boolean> {
  const ahora = new Date().toISOString()
  const hayCambios = await db.transaction('rw', db.table(tabla), db.pendientes, async () => {
    const actual = await db.table(tabla).get(id)
    if (!actual) throw new Error('Este registro ya no existe en el móvil.')
    const cambios = Object.fromEntries(
      Object.entries(soloEditables(tabla, datos)).filter(([campo, valor]) => !iguales(actual[campo], valor)),
    )
    if (Object.keys(cambios).length === 0) return false
    await db.table(tabla).update(id, { ...cambios, updated_at: ahora, updated_by: idUsuario })
    await db.pendientes.add({
      tabla,
      fila_id: id,
      operacion: 'modificar',
      cambios,
      creado: ahora,
      intentos: 0,
      error: null,
    })
    return true
  })
  if (hayCambios) programarSincronizacion()
  return hayCambios
}

/**
 * Elimina un registro (y lo que cuelga de él). En el servidor solo se marca
 * como eliminado, y el propio servidor elimina en cascada.
 */
export async function eliminar(tabla: Tabla, id: string) {
  const ahora = new Date().toISOString()
  await db.transaction('rw', [db.socios, db.fincas, db.recintos, db.fotos, db.pendientes], async () => {
    let fincas: string[] = []
    if (tabla === 'socios') fincas = await db.fincas.where('socio_id').equals(id).primaryKeys()
    if (tabla === 'fincas') fincas = [id]
    if (fincas.length) {
      await db.recintos.where('finca_id').anyOf(fincas).delete()
      await db.fotos.where('finca_id').anyOf(fincas).delete()
      await db.fincas.bulkDelete(fincas)
    }
    await db.table(tabla).delete(id)
    await db.pendientes.add({
      tabla,
      fila_id: id,
      operacion: 'modificar',
      cambios: { eliminado: true },
      creado: ahora,
      intentos: 0,
      error: null,
    })
  })
  programarSincronizacion()
}
