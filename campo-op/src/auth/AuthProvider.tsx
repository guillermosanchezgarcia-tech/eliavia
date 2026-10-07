import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { esErrorDeConexion, mensajeDeError } from '../lib/errores'
import { supabase } from '../lib/supabase'
import type { Perfil } from '../lib/tipos'
import { ContextoAuth, type EstadoSesion } from './contexto'

// El perfil se guarda también en el móvil para poder abrir la app sin
// cobertura: si no hay conexión, se usa la última copia conocida.
const CLAVE_PERFIL = 'campo-op:perfil'

function leerPerfilGuardado(): Perfil | null {
  try {
    const texto = localStorage.getItem(CLAVE_PERFIL)
    return texto ? (JSON.parse(texto) as Perfil) : null
  } catch {
    return null
  }
}

function guardarPerfil(perfil: Perfil | null) {
  try {
    if (perfil) localStorage.setItem(CLAVE_PERFIL, JSON.stringify(perfil))
    else localStorage.removeItem(CLAVE_PERFIL)
  } catch {
    // Sin almacenamiento disponible (modo privado): la app sigue funcionando con conexión.
  }
}

async function obtenerPerfil(idUsuario: string): Promise<Perfil> {
  const { data, error } = await supabase.from('perfiles').select('*').eq('id', idUsuario).maybeSingle()
  if (error) {
    const guardado = leerPerfilGuardado()
    if (guardado?.id === idUsuario && esErrorDeConexion(error)) return guardado
    throw new Error(mensajeDeError(error))
  }
  if (!data) {
    throw new Error(
      'Tu usuario no tiene perfil en la base de datos. Comprueba que se ha ejecutado el archivo 01_esquema.sql en Supabase.',
    )
  }
  guardarPerfil(data as Perfil)
  return data as Perfil
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<EstadoSesion>({ tipo: 'cargando' })
  const [recuperandoClave, setRecuperandoClave] = useState(false)

  const aplicarUsuario = useCallback(async (idUsuario: string) => {
    try {
      const perfil = await obtenerPerfil(idUsuario)
      setSesion({ tipo: 'con-sesion', perfil })
    } catch (e) {
      setSesion({ tipo: 'error', mensaje: e instanceof Error ? e.message : String(e) })
    }
  }, [])

  useEffect(() => {
    let cancelado = false

    supabase.auth.getSession().then(({ data, error }) => {
      if (cancelado) return
      if (data.session) {
        void aplicarUsuario(data.session.user.id)
        return
      }
      // Sin cobertura y con la sesión caducada: Supabase no puede renovarla,
      // pero el usuario ya había entrado en este móvil, así que le dejamos
      // trabajar con la copia local. La sesión se renueva sola al volver la red.
      const guardado = leerPerfilGuardado()
      if (error && isAuthRetryableFetchError(error) && guardado) {
        setSesion({ tipo: 'con-sesion', perfil: guardado })
        return
      }
      guardarPerfil(null)
      setSesion({ tipo: 'sin-sesion' })
    })

    const { data } = supabase.auth.onAuthStateChange((evento, nueva) => {
      if (evento === 'SIGNED_OUT') {
        guardarPerfil(null)
        setSesion({ tipo: 'sin-sesion' })
        return
      }
      if (evento === 'PASSWORD_RECOVERY') setRecuperandoClave(true)
      if ((evento === 'SIGNED_IN' || evento === 'USER_UPDATED' || evento === 'PASSWORD_RECOVERY') && nueva) {
        // Supabase recomienda no llamar a la base de datos dentro de este aviso.
        setTimeout(() => void aplicarUsuario(nueva.user.id), 0)
      }
    })

    return () => {
      cancelado = true
      data.subscription.unsubscribe()
    }
  }, [aplicarUsuario])

  const iniciarSesion = useCallback(async (email: string, clave: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: clave })
    return error ? mensajeDeError(error) : null
  }, [])

  const cerrarSesion = useCallback(async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) {
      // Sin conexión Supabase no puede avisar al servidor; borramos la sesión
      // del móvil igualmente.
      try {
        Object.keys(localStorage)
          .filter((clave) => clave.startsWith('sb-') && clave.endsWith('-auth-token'))
          .forEach((clave) => localStorage.removeItem(clave))
      } catch {
        // nada que hacer
      }
      guardarPerfil(null)
      window.location.assign('/login')
    }
  }, [])

  const recargarPerfil = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) await aplicarUsuario(data.session.user.id)
  }, [aplicarUsuario])

  const valor = useMemo(
    () => ({
      sesion,
      recuperandoClave,
      terminarRecuperacion: () => setRecuperandoClave(false),
      iniciarSesion,
      cerrarSesion,
      recargarPerfil,
    }),
    [sesion, recuperandoClave, iniciarSesion, cerrarSesion, recargarPerfil],
  )

  return <ContextoAuth.Provider value={valor}>{children}</ContextoAuth.Provider>
}
