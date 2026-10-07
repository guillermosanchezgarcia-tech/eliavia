// Lecturas de la base de datos del móvil. Con «useLiveQuery» las pantallas se
// actualizan solas cuando cambian los datos (al guardar o al sincronizar).
// Mientras se cargan devuelven «undefined».

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

export function useSocios() {
  return useLiveQuery(() => db.socios.toArray(), [])
}

export function useSocio(id: string | undefined) {
  return useLiveQuery(async () => (id ? ((await db.socios.get(id)) ?? null) : null), [id])
}

export function useFincas() {
  return useLiveQuery(() => db.fincas.toArray(), [])
}

export function useFincasDeSocio(idSocio: string | undefined) {
  return useLiveQuery(
    () => (idSocio ? db.fincas.where('socio_id').equals(idSocio).sortBy('nombre') : []),
    [idSocio],
  )
}

/** Nombre de cada usuario por su id, para mostrar «modificado por…». */
export function useNombresUsuarios() {
  return useLiveQuery(async () => {
    const perfiles = await db.perfiles.toArray()
    return new Map(perfiles.map((p) => [p.id, p.nombre || p.email]))
  }, [])
}

export function usePendientes() {
  return useLiveQuery(() => db.pendientes.orderBy('num').toArray(), [])
}

export function useAjuste<T>(clave: string) {
  return useLiveQuery(async () => ((await db.ajustes.get(clave))?.valor as T | undefined) ?? null, [clave])
}
