// Motor de sincronización entre el móvil y Supabase.
//
//   0. SUBIR FOTOS: las fotos hechas en el móvil se suben a Supabase Storage.
//   1. ENVIAR: recorre la lista de «pendientes» en orden y la manda a Supabase.
//      · Si no hay conexión, para y lo reintenta más tarde (no se pierde nada).
//      · Si Supabase rechaza un cambio (p. ej. código de socio repetido), lo
//        marca con el motivo para que el usuario lo vea en «Más → Sincronización»
//        y sigue con los demás.
//   2. DESCARGAR: pide a Supabase lo que haya cambiado desde la última vez
//      (por fecha de modificación) y lo guarda en el móvil, respetando los
//      cambios propios que aún no se hayan enviado.
//
// Se lanza sola: al abrir la app, al recuperar la cobertura, poco después de
// guardar algo y cada pocos minutos mientras la app está abierta.

import { useSyncExternalStore } from 'react'
import { esErrorDeConexion, mensajeDeError, mensajeDeErrorSubida } from '../lib/errores'
import { supabase } from '../lib/supabase'
import type { Perfil } from '../lib/tipos'
import { db, guardarAjuste, leerAjuste, TABLAS, type Pendiente, type Tabla } from './db'

const TAM_PAGINA = 1000
/** Al descargar se repasan también los últimos minutos, por si algún cambio
 *  se guardó en el servidor justo mientras se descargaba. */
const MARGEN_MS = 2 * 60 * 1000
const UUID_CERO = '00000000-0000-0000-0000-000000000000'
export const CLAVE_ULTIMA_SINCRONIZACION = 'ultima_sincronizacion'

// ---------------------------------------------------------------------------
// Estado visible para las pantallas
// ---------------------------------------------------------------------------

export interface EstadoSincronizacion {
  sincronizando: boolean
  /** Problema general (servidor caído, base de datos sin preparar…). */
  error: string | null
}

let estado: EstadoSincronizacion = { sincronizando: false, error: null }
const oyentes = new Set<() => void>()

function cambiarEstado(nuevo: Partial<EstadoSincronizacion>) {
  estado = { ...estado, ...nuevo }
  oyentes.forEach((o) => o())
}

export function useEstadoSincronizacion(): EstadoSincronizacion {
  return useSyncExternalStore(
    (o) => {
      oyentes.add(o)
      return () => oyentes.delete(o)
    },
    () => estado,
  )
}

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

/** Error pasajero: se reintenta más tarde sin molestar al usuario con él. */
class ErrorPasajero extends Error {}

interface RespuestaSupabase {
  error: { message: string; code?: string } | null
  status: number
}

function esPasajero({ error, status }: RespuestaSupabase): boolean {
  if (!error) return false
  return (
    esErrorDeConexion(error) ||
    status === 0 ||
    status === 401 ||
    status === 408 ||
    status === 429 ||
    status >= 500 ||
    Boolean(error.code?.startsWith('PGRST3')) // sesión caducada
  )
}

/** Errores que no dependen de un cambio concreto sino de la instalación. */
function esErrorDeInstalacion(error: { code?: string }): boolean {
  return error.code === 'PGRST205' || error.code === '42P01' || error.code === 'PGRST204'
}

const MENSAJE_INSTALACION =
  'La base de datos no está preparada. Ejecuta el archivo supabase/01_esquema.sql en Supabase (SQL Editor).'

function lanzar(respuesta: RespuestaSupabase): never {
  if (esPasajero(respuesta)) {
    const caido = respuesta.status >= 500
    throw new ErrorPasajero(
      caido
        ? 'El servidor no responde. Si el proyecto de Supabase está en pausa, hay que reactivarlo desde supabase.com.'
        : 'Sin conexión',
    )
  }
  if (respuesta.error && esErrorDeInstalacion(respuesta.error)) throw new Error(MENSAJE_INSTALACION)
  throw new Error(mensajeDeError(respuesta.error))
}

// ---------------------------------------------------------------------------
// Sincronizar
// ---------------------------------------------------------------------------

let enCurso: Promise<void> | null = null
let repetir = false

/**
 * Sincroniza ahora. Si ya hay una sincronización en marcha, se hace otra
 * vuelta al terminar (para incluir lo que se haya guardado mientras tanto).
 */
export function sincronizar(): Promise<void> {
  if (enCurso) {
    repetir = true
    return enCurso
  }
  enCurso = (async () => {
    do {
      repetir = false
      await vuelta()
    } while (repetir)
  })().finally(() => {
    enCurso = null
  })
  return enCurso
}

async function vuelta() {
  if (!navigator.onLine) return
  cambiarEstado({ sincronizando: true })
  try {
    await subirArchivos()
    await enviarPendientes()
    await descargarPerfiles()
    for (const tabla of TABLAS) await descargarTabla(tabla)
    await guardarAjuste(CLAVE_ULTIMA_SINCRONIZACION, new Date().toISOString())
    cambiarEstado({ sincronizando: false, error: null })
  } catch (e) {
    const pasajero = e instanceof ErrorPasajero
    cambiarEstado({
      sincronizando: false,
      error: pasajero ? (e.message === 'Sin conexión' ? null : e.message) : mensajeDeError(e),
    })
  }
}

let temporizador: ReturnType<typeof setTimeout> | undefined

/** Sincroniza dentro de un momento (agrupa varios guardados seguidos). */
export function programarSincronizacion(retraso = 1500) {
  clearTimeout(temporizador)
  temporizador = setTimeout(() => void sincronizar(), retraso)
}

// ---------------------------------------------------------------------------
// 0. Subir las fotos hechas en el móvil
// ---------------------------------------------------------------------------

export const BUCKET_FOTOS = 'fotos'

async function subirArchivos() {
  const lista = await db.archivos.where('subido').equals(0).toArray()
  for (const a of lista) {
    if (a.error) continue
    const { error } = await supabase.storage
      .from(BUCKET_FOTOS)
      .upload(a.ruta, a.blob, { contentType: a.blob.type || 'image/jpeg', upsert: false })
    // «Ya existe»: la subida anterior llegó aunque se perdiera la respuesta.
    const yaEstaba = error && 'statusCode' in error && String(error.statusCode) === '409'
    if (!error || yaEstaba) {
      await db.archivos.update(a.id, { subido: 1, error: null })
      continue
    }
    const status = 'status' in error && typeof error.status === 'number' ? error.status : 0
    if (esPasajero({ error, status })) lanzar({ error, status })
    await db.archivos.update(a.id, { error: `No se ha podido subir la foto. ${mensajeDeErrorSubida(error)}` })
  }
}

// ---------------------------------------------------------------------------
// 1. Enviar los cambios pendientes
// ---------------------------------------------------------------------------

async function enviarPendientes() {
  const lista = await db.pendientes.orderBy('num').toArray()
  // Si un cambio de un registro falla, los siguientes de ese mismo registro
  // esperan: dependen de él.
  const bloqueados = new Set<string>()

  for (const p of lista) {
    const clave = `${p.tabla}:${p.fila_id}`
    if (p.error || bloqueados.has(clave)) {
      bloqueados.add(clave)
      continue
    }
    // Una foto no se da de alta hasta que su archivo está subido.
    if (p.tabla === 'fotos' && p.operacion === 'crear') {
      const archivo = await db.archivos.get(p.fila_id)
      if (archivo && !archivo.subido) {
        if (archivo.error) await db.pendientes.update(p.num!, { error: archivo.error })
        bloqueados.add(clave)
        continue
      }
    }
    const respuesta = await enviar(p)
    if (!respuesta.error) {
      await db.pendientes.delete(p.num!)
      continue
    }
    if (esPasajero(respuesta) || esErrorDeInstalacion(respuesta.error)) lanzar(respuesta)
    await db.pendientes.update(p.num!, { error: mensajeDeError(respuesta.error), intentos: p.intentos + 1 })
    bloqueados.add(clave)
  }
}

async function enviar(p: Pendiente): Promise<RespuestaSupabase> {
  if (p.operacion === 'crear') {
    // «upsert»: si el envío anterior llegó pero se perdió la respuesta, no
    // se duplica el registro.
    const { error, status } = await supabase
      .from(p.tabla)
      .upsert({ id: p.fila_id, ...p.cambios }, { onConflict: 'id' })
      .select('id')
    return { error, status }
  }
  const { data, error, status } = await supabase.from(p.tabla).update(p.cambios).eq('id', p.fila_id).select('id')
  if (!error && data.length === 0) {
    return { error: { message: 'El registro ya no existe en el servidor o no tienes permiso para cambiarlo.' }, status }
  }
  return { error, status }
}

// ---------------------------------------------------------------------------
// 2. Descargar lo que ha cambiado
// ---------------------------------------------------------------------------

interface Cursor {
  /** Fecha de modificación (tal cual la da el servidor) del último registro descargado. */
  t: string
  id: string
}

function restarMargen(fecha: string): string {
  // Se recortan los microsegundos para que todos los navegadores la entiendan.
  const ms = Date.parse(fecha.replace(/(\.\d{3})\d+/, '$1'))
  return new Date(ms - MARGEN_MS).toISOString()
}

async function descargarTabla(tabla: Tabla) {
  const claveCursor = `cursor:${tabla}`
  const guardado = await leerAjuste<Cursor>(claveCursor)
  let cursor: Cursor | null = guardado ? { t: restarMargen(guardado.t), id: UUID_CERO } : null

  for (;;) {
    let consulta = supabase.from(tabla).select('*').order('updated_at').order('id').limit(TAM_PAGINA)
    if (cursor) {
      consulta = consulta.or(
        `updated_at.gt."${cursor.t}",and(updated_at.eq."${cursor.t}",id.gt.${cursor.id})`,
      )
    }
    const { data, error, status } = await consulta
    if (error) lanzar({ error, status })
    if (!data.length) break

    await aplicarDescarga(tabla, data as { id: string; updated_at: string; eliminado: boolean }[])
    const ultima = data[data.length - 1] as { id: string; updated_at: string }
    cursor = { t: ultima.updated_at, id: ultima.id }
    await guardarAjuste(claveCursor, cursor)
    if (data.length < TAM_PAGINA) break
  }
}

/** Guarda en el móvil lo descargado, sin pisar los cambios propios aún no enviados. */
export async function aplicarDescarga(tabla: Tabla, filas: { id: string; eliminado: boolean }[]) {
  const tablaLocal = db.table(tabla)
  await db.transaction('rw', tablaLocal, db.pendientes, async () => {
    const pendientes = await db.pendientes.where('tabla').equals(tabla).sortBy('num')
    const porFila = new Map<string, Pendiente[]>()
    for (const p of pendientes) porFila.set(p.fila_id, [...(porFila.get(p.fila_id) ?? []), p])

    for (const fila of filas) {
      let final: Record<string, unknown> = fila
      for (const p of porFila.get(fila.id) ?? []) final = { ...final, ...p.cambios }
      if (final.eliminado) await tablaLocal.delete(fila.id)
      else await tablaLocal.put(final)
    }
  })
}

async function descargarPerfiles() {
  const { data, error, status } = await supabase
    .from('perfiles')
    .select('id, email, nombre, rol, activo, created_at, updated_at')
  if (error) lanzar({ error, status })
  const perfiles = data as Perfil[]
  await db.transaction('rw', db.perfiles, async () => {
    await db.perfiles.clear()
    await db.perfiles.bulkPut(perfiles)
  })
}
