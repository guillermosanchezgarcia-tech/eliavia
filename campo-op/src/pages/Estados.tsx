// Pantallas especiales: cargando, error, cuenta desactivada y app sin configurar.

import { LoaderCircle, LogOut, RefreshCw, Settings, ShieldOff, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/contexto'
import { Logo } from '../components/Logo'
import { Boton } from '../components/ui'

function Marco({ children }: { children: ReactNode }) {
  return (
    <div className="pt-seguro pb-seguro flex min-h-dvh items-center justify-center bg-fondo px-5">
      <div className="w-full max-w-sm text-center">{children}</div>
    </div>
  )
}

export function PantallaCargando() {
  return (
    <Marco>
      <Logo className="mx-auto mb-6 size-16" />
      <LoaderCircle className="mx-auto size-7 animate-spin text-marca-600" aria-label="Cargando" />
    </Marco>
  )
}

export function PantallaError({ mensaje }: { mensaje: string }) {
  const { cerrarSesion } = useAuth()
  return (
    <Marco>
      <TriangleAlert className="mx-auto mb-4 size-12 text-amber-600" aria-hidden />
      <h1 className="text-xl font-bold text-stone-900">No se ha podido abrir la app</h1>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">{mensaje}</p>
      <div className="mt-6 flex flex-col gap-2">
        <Boton icono={RefreshCw} onClick={() => window.location.reload()}>
          Reintentar
        </Boton>
        <Boton variante="fantasma" icono={LogOut} onClick={() => void cerrarSesion()}>
          Cerrar sesión
        </Boton>
      </div>
    </Marco>
  )
}

export function CuentaDesactivada() {
  const { cerrarSesion } = useAuth()
  return (
    <Marco>
      <ShieldOff className="mx-auto mb-4 size-12 text-red-600" aria-hidden />
      <h1 className="text-xl font-bold text-stone-900">Tu cuenta no tiene acceso</h1>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">
        Un administrador ha desactivado tu acceso a la app. Si crees que es un error, habla con la OP.
      </p>
      <Boton className="mt-6" variante="secundario" icono={LogOut} bloque onClick={() => void cerrarSesion()}>
        Cerrar sesión
      </Boton>
    </Marco>
  )
}

export function ConfiguracionPendiente() {
  return (
    <Marco>
      <Settings className="mx-auto mb-4 size-12 text-marca-700" aria-hidden />
      <h1 className="text-xl font-bold text-stone-900">Falta conectar Supabase</h1>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">
        La app todavía no sabe a qué base de datos conectarse. Hay que indicar estas dos variables (en Netlify o en el
        archivo <code>.env.local</code>):
      </p>
      <pre className="mt-4 overflow-x-auto rounded-xl bg-stone-900 p-4 text-left text-xs leading-relaxed text-stone-100">
        VITE_SUPABASE_URL{'\n'}VITE_SUPABASE_PUBLISHABLE_KEY
      </pre>
      <p className="mt-4 text-sm text-stone-500">Los pasos están en el archivo README.md del proyecto.</p>
    </Marco>
  )
}
