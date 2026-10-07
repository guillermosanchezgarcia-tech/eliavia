import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js'

/** ¿El error se debe a que no hay conexión a internet? */
export function esErrorDeConexion(error: unknown): boolean {
  if (isAuthRetryableFetchError(error)) return true
  const mensaje = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error)
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(mensaje)
}

const MENSAJES_AUTH: Record<string, string> = {
  invalid_credentials: 'Email o contraseña incorrectos.',
  email_not_confirmed: 'Este email aún no está confirmado. Pide al administrador que lo confirme.',
  user_banned: 'Este usuario está bloqueado. Habla con el administrador.',
  over_request_rate_limit: 'Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.',
  over_email_send_rate_limit: 'Se han enviado demasiados emails. Espera unos minutos y vuelve a probar.',
  weak_password: 'La contraseña es demasiado débil. Usa al menos 8 caracteres mezclando letras y números.',
  same_password: 'La nueva contraseña tiene que ser distinta de la anterior.',
  session_not_found: 'La sesión ha caducado. Vuelve a entrar.',
  otp_expired: 'El enlace ha caducado. Pide uno nuevo.',
}

/** Convierte cualquier error en un mensaje en español para mostrar al usuario. */
export function mensajeDeError(error: unknown): string {
  if (!error) return ''
  if (esErrorDeConexion(error)) {
    return 'No hay conexión con el servidor. Comprueba la cobertura y vuelve a intentarlo.'
  }
  if (isAuthError(error) && error.code && MENSAJES_AUTH[error.code]) {
    return MENSAJES_AUTH[error.code]
  }
  const e = error as { code?: string; message?: string }
  if (e.code === '42501') {
    return e.message?.startsWith('Solo') ? e.message : 'No tienes permiso para hacer esto.'
  }
  if (e.code === '23505') return 'Ya existe un registro con ese código.'
  return e.message || 'Ha ocurrido un error inesperado.'
}
