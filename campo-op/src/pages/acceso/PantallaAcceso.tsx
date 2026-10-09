import type { ReactNode } from 'react'
import { Logo } from '../../components/Logo'
import { config } from '../../config'

/** Marco común de las pantallas de entrada (login, recuperar contraseña…). */
export function PantallaAcceso({ titulo, subtitulo, children }: {
  titulo: string
  subtitulo?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="pt-seguro pb-seguro flex min-h-dvh flex-col bg-gradient-to-b from-marca-50 to-fondo">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="mb-4 size-16 drop-shadow-sm" />
          <p className="text-sm font-semibold tracking-wide text-marca-800 uppercase">{config.nombreOP}</p>
          <h1 className="mt-1 text-2xl font-bold text-stone-900">{titulo}</h1>
          {subtitulo && <p className="mt-2 text-sm leading-relaxed text-stone-600">{subtitulo}</p>}
        </div>
        {children}
      </main>
      <p className="px-5 pb-6 text-center text-xs text-stone-400">
        {config.nombreApp} · Gestión de socios y fincas
      </p>
    </div>
  )
}
