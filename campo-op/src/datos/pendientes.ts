import { supabase } from '../lib/supabase'
import { mensajeDeError } from '../lib/errores'
import { db, type Pendiente } from './db'
import { sincronizar } from './sincronizacion'

/**
 * Descarta los cambios de un registro que Supabase ha rechazado y recupera la
 * versión del servidor (o lo quita del móvil si nunca llegó a crearse).
 * Necesita conexión. Devuelve un mensaje de error o null.
 */
export async function descartarCambios(p: Pendiente): Promise<string | null> {
  const { data, error } = await supabase.from(p.tabla).select('*').eq('id', p.fila_id).maybeSingle()
  if (error) return mensajeDeError(error)
  await db.transaction('rw', db.table(p.tabla), db.pendientes, async () => {
    await db.pendientes.where('[tabla+fila_id]').equals([p.tabla, p.fila_id]).delete()
    if (data && !data.eliminado) await db.table(p.tabla).put(data)
    else await db.table(p.tabla).delete(p.fila_id)
  })
  void sincronizar()
  return null
}

/** Vuelve a intentar enviar un cambio que dio error (p. ej. tras corregir el dato). */
export async function reintentar(p: Pendiente) {
  await db.pendientes.update(p.num!, { error: null })
  await sincronizar()
}
