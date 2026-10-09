import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { useAuth, usePerfil } from '../auth/contexto'
import { db, guardarAjuste, leerAjuste, vaciarDatosLocales } from './db'
import { fijarUsuarioActual } from './escritura'
import { sincronizar } from './sincronizacion'

const CINCO_MINUTOS = 5 * 60 * 1000

/**
 * Pieza invisible que vive mientras hay sesión iniciada y lanza la
 * sincronización en los momentos adecuados.
 */
export function MotorSincronizacion() {
  const perfil = usePerfil()
  const { recargarPerfil } = useAuth()

  useEffect(() => {
    fijarUsuarioActual(perfil.id)
    let activo = true

    void (async () => {
      // Si en este móvil había entrado otra persona, sus datos se borran.
      const anterior = await leerAjuste<string>('usuario')
      if (anterior && anterior !== perfil.id) await vaciarDatosLocales()
      await guardarAjuste('usuario', perfil.id)
      if (activo) void sincronizar()
    })()

    const siVisible = () => {
      if (document.visibilityState === 'visible') void sincronizar()
    }
    const alVolverLaRed = () => void sincronizar()
    window.addEventListener('online', alVolverLaRed)
    document.addEventListener('visibilitychange', siVisible)
    const intervalo = setInterval(siVisible, CINCO_MINUTOS)

    return () => {
      activo = false
      window.removeEventListener('online', alVolverLaRed)
      document.removeEventListener('visibilitychange', siVisible)
      clearInterval(intervalo)
      fijarUsuarioActual(null)
    }
  }, [perfil.id])

  // Si un administrador me cambia el rol o me quita el acceso, se aplica en
  // cuanto llega la sincronización.
  const yo = useLiveQuery(() => db.perfiles.get(perfil.id), [perfil.id])
  const distinto =
    yo !== undefined && (yo.rol !== perfil.rol || yo.activo !== perfil.activo || yo.nombre !== perfil.nombre)
  useEffect(() => {
    if (distinto) void recargarPerfil()
  }, [distinto, recargarPerfil])

  return null
}
