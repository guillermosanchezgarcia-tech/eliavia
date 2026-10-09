import { createContext, useContext } from 'react'
import type { Perfil } from '../lib/tipos'

export type EstadoSesion =
  | { tipo: 'cargando' }
  | { tipo: 'sin-sesion' }
  | { tipo: 'con-sesion'; perfil: Perfil }
  | { tipo: 'error'; mensaje: string }

export interface ValorAuth {
  sesion: EstadoSesion
  /** true si el usuario ha llegado desde el email de «He olvidado mi contraseña». */
  recuperandoClave: boolean
  terminarRecuperacion: () => void
  /** Devuelve un mensaje de error, o null si ha ido bien. */
  iniciarSesion: (email: string, clave: string) => Promise<string | null>
  cerrarSesion: () => Promise<void>
  recargarPerfil: () => Promise<void>
}

export const ContextoAuth = createContext<ValorAuth | null>(null)

export function useAuth(): ValorAuth {
  const valor = useContext(ContextoAuth)
  if (!valor) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return valor
}

/** Perfil del usuario con sesión iniciada (solo dentro de la zona privada). */
export function usePerfil(): Perfil {
  const { sesion } = useAuth()
  if (sesion.tipo !== 'con-sesion') throw new Error('No hay sesión iniciada')
  return sesion.perfil
}
