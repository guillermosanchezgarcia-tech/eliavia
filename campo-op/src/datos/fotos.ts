// Fotos de las fincas: se guardan en el móvil al momento y se suben a
// Supabase Storage al sincronizar. Las de otros se descargan al verlas y se
// quedan guardadas para poder verlas sin conexión.

import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { useConexion } from '../hooks/useConexion'
import { reducirImagen } from '../lib/imagen'
import { supabase } from '../lib/supabase'
import type { Foto } from '../lib/tipos'
import { db } from './db'
import { crear, eliminar } from './escritura'
import { BUCKET_FOTOS } from './sincronizacion'

/** Añade una foto a una finca. Devuelve el id de la foto. */
export async function agregarFoto(idFinca: string, archivo: Blob): Promise<string> {
  const blob = await reducirImagen(archivo)
  const id = crypto.randomUUID()
  const ruta = `fincas/${idFinca}/${id}.jpg`
  const ahora = new Date().toISOString()
  await db.archivos.put({ id, finca_id: idFinca, ruta, blob, subido: 0, error: null, creado: ahora })
  await crear('fotos', { finca_id: idFinca, ruta, descripcion: null, tomada_en: ahora }, id)
  return id
}

export async function eliminarFoto(foto: Foto) {
  await eliminar('fotos', foto.id)
  // Si ya estaba subida, no hace falta guardarla en el móvil. Si no, se deja
  // para que la sincronización termine en orden (subir, crear y eliminar).
  const archivo = await db.archivos.get(foto.id)
  if (archivo?.subido) await db.archivos.delete(foto.id)
}

const descargando = new Map<string, Promise<void>>()

async function descargar(foto: Foto) {
  const { data, error } = await supabase.storage.from(BUCKET_FOTOS).download(foto.ruta)
  if (error || !data) throw error ?? new Error('Foto no encontrada')
  await db.archivos.put({
    id: foto.id,
    finca_id: foto.finca_id,
    ruta: foto.ruta,
    blob: data,
    subido: 1,
    error: null,
    creado: new Date().toISOString(),
  })
}

export type EstadoFoto = { tipo: 'cargando' } | { tipo: 'lista'; url: string } | { tipo: 'sin-conexion' } | { tipo: 'error' }

/** Dirección para mostrar una foto: la copia del móvil o, si no la hay, la descarga. */
export function useFoto(foto: Foto): EstadoFoto {
  // undefined = consultando; null = no está en el móvil.
  const archivo = useLiveQuery(async () => (await db.archivos.get(foto.id)) ?? null, [foto.id])
  const conexion = useConexion()
  const blob = archivo?.blob ?? null
  const [fallo, setFallo] = useState<{ id: string; tipo: 'sin-conexion' | 'error' } | null>(null)
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  useEffect(() => {
    if (archivo !== null) return
    let vigente = true
    let tarea = descargando.get(foto.id)
    if (!tarea) {
      tarea = navigator.onLine ? descargar(foto) : Promise.reject(new Error('sin conexión'))
      tarea = tarea.finally(() => descargando.delete(foto.id))
      descargando.set(foto.id, tarea)
    }
    tarea.catch(() => {
      if (vigente) setFallo({ id: foto.id, tipo: navigator.onLine ? 'error' : 'sin-conexion' })
    })
    return () => {
      vigente = false
    }
    // Al volver la conexión se intenta otra vez.
  }, [archivo, foto, conexion])

  if (url) return { tipo: 'lista', url }
  if (fallo?.id === foto.id) return { tipo: fallo.tipo }
  return { tipo: 'cargando' }
}
