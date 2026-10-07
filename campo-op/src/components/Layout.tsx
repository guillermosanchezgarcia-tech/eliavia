// Estructura común de todas las pantallas una vez dentro de la app:
//   · Móvil: barra de navegación abajo, al alcance del pulgar.
//   · Ordenador: menú lateral a la izquierda.

import { ArrowLeft, House, Map as IconoMapa, Menu, Sprout, Users, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { usePerfil } from '../auth/contexto'
import { config } from '../config'
import { cx } from '../lib/cx'
import { NOMBRES_ROL } from '../lib/tipos'
import { MotorSincronizacion } from '../datos/MotorSincronizacion'
import { AvisoActualizacion } from './AvisoActualizacion'
import { IndicadorSincronizacion } from './IndicadorSincronizacion'
import { Logo } from './Logo'

interface Seccion {
  a: string
  texto: string
  icono: LucideIcon
}

const SECCIONES: Seccion[] = [
  { a: '/', texto: 'Inicio', icono: House },
  { a: '/socios', texto: 'Socios', icono: Users },
  { a: '/fincas', texto: 'Fincas', icono: Sprout },
  { a: '/mapa', texto: 'Mapa', icono: IconoMapa },
  { a: '/mas', texto: 'Más', icono: Menu },
]

export function Layout() {
  return (
    <div className="min-h-dvh lg:pl-72">
      <MenuLateral />
      <main className="pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-10">
        <Outlet />
      </main>
      <BarraInferior />
      <AvisoActualizacion />
      <MotorSincronizacion />
    </div>
  )
}

function BarraInferior() {
  return (
    <nav
      aria-label="Secciones"
      className="pb-seguro fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {SECCIONES.map(({ a, texto, icono: Icono }) => (
          <li key={a}>
            <NavLink
              to={a}
              end={a === '/'}
              className={({ isActive }) =>
                cx(
                  'flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition',
                  isActive ? 'text-marca-800' : 'text-stone-500 active:text-stone-800',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cx(
                      'grid h-8 w-14 place-items-center rounded-full transition',
                      isActive && 'bg-marca-100',
                    )}
                  >
                    <Icono className="size-[22px]" strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                  </span>
                  {texto}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function MenuLateral() {
  const perfil = usePerfil()
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-stone-200 bg-white lg:flex">
      <div className="flex items-center gap-3 px-6 py-6">
        <Logo className="size-11" />
        <div>
          <p className="text-lg leading-tight font-bold text-stone-900">{config.nombreApp}</p>
          <p className="text-sm text-stone-500">{config.nombreOP}</p>
        </div>
      </div>
      <nav aria-label="Secciones" className="flex-1 px-3">
        <ul className="space-y-1">
          {SECCIONES.map(({ a, texto, icono: Icono }) => (
            <li key={a}>
              <NavLink
                to={a}
                end={a === '/'}
                className={({ isActive }) =>
                  cx(
                    'flex min-h-12 items-center gap-3 rounded-xl px-4 font-medium transition',
                    isActive ? 'bg-marca-50 text-marca-800' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900',
                  )
                }
              >
                <Icono className="size-5" aria-hidden />
                {texto === 'Más' ? 'Ajustes' : texto}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-stone-200 px-6 py-4">
        <p className="truncate font-medium text-stone-900">{perfil.nombre || perfil.email}</p>
        <p className="text-sm text-stone-500">{NOMBRES_ROL[perfil.rol]}</p>
      </div>
    </aside>
  )
}

/** Cabecera de cada pantalla: título, botón «atrás» opcional y acciones. */
export function Cabecera({ titulo, subtitulo, atras, acciones, children }: {
  titulo: string
  subtitulo?: ReactNode
  /**
   * A dónde vuelve la flecha: una ruta fija, o `true` para volver a la
   * pantalla anterior (si se llegó por un enlace directo, va al inicio).
   */
  atras?: string | true
  acciones?: ReactNode
  /** Contenido fijo bajo el título (buscador, filtros…). */
  children?: ReactNode
}) {
  const navegar = useNavigate()
  const volver = () => {
    if (atras !== true) navegar(atras ?? '/')
    else if ((window.history.state as { idx?: number } | null)?.idx) navegar(-1)
    else navegar('/')
  }
  return (
    <header className="pt-seguro sticky top-0 z-20 border-b border-stone-200/80 bg-fondo">
      <div className="mx-auto flex min-h-16 max-w-3xl items-center gap-2 px-4 lg:px-8">
        {atras && (
          <button
            type="button"
            onClick={volver}
            className="-ml-2 grid size-12 shrink-0 place-items-center rounded-full text-stone-700 hover:bg-stone-200/60 active:bg-stone-200"
            aria-label="Volver"
          >
            <ArrowLeft className="size-6" aria-hidden />
          </button>
        )}
        <div className="min-w-0 flex-1 py-2">
          <h1 className="truncate text-xl font-bold text-stone-900">{titulo}</h1>
          {subtitulo && <p className="truncate text-sm text-stone-500">{subtitulo}</p>}
        </div>
        <IndicadorSincronizacion />
        {acciones}
      </div>
      {children && <div className="mx-auto max-w-3xl px-4 pb-3 lg:px-8">{children}</div>}
    </header>
  )
}

/** Contenedor del cuerpo de cada pantalla, con márgenes y ancho máximo. */
export function Contenido({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('mx-auto max-w-3xl px-4 py-5 lg:px-8 lg:py-8', className)}>{children}</div>
}
