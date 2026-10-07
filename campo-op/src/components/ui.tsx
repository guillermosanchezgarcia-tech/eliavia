// Piezas de interfaz reutilizables: botones, campos de formulario, avisos…
// Todas tienen un tamaño mínimo de 48 px para poder pulsarlas con el pulgar.

import {
  CircleCheck,
  Info,
  LoaderCircle,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router'
import { cx } from '../lib/cx'

type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'fantasma'

const ESTILO_BOTON: Record<VarianteBoton, string> = {
  primario: 'bg-marca-700 text-white shadow-sm hover:bg-marca-800 active:bg-marca-900',
  secundario: 'bg-white text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50 active:bg-stone-100',
  peligro: 'bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50 active:bg-red-100',
  fantasma: 'text-marca-800 hover:bg-marca-50 active:bg-marca-100',
}

const BASE_BOTON =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition select-none disabled:pointer-events-none disabled:opacity-60'

interface PropsBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton
  icono?: LucideIcon
  cargando?: boolean
  bloque?: boolean
}

export function Boton({
  variante = 'primario',
  icono: Icono,
  cargando = false,
  bloque = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: PropsBoton) {
  return (
    <button
      type={type}
      disabled={disabled || cargando}
      className={cx(BASE_BOTON, ESTILO_BOTON[variante], bloque && 'w-full', className)}
      {...props}
    >
      {cargando ? (
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
      ) : (
        Icono && <Icono className="size-5" aria-hidden />
      )}
      {children}
    </button>
  )
}

interface PropsCampo extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string
  ayuda?: ReactNode
  error?: string | null
  /** Elemento que se pinta a la derecha dentro del campo (p. ej. «ver contraseña»). */
  accesorio?: ReactNode
}

export function Campo({ etiqueta, ayuda, error, accesorio, className, id, ...props }: PropsCampo) {
  const idAuto = useId()
  const idCampo = id ?? idAuto
  const idAyuda = `${idCampo}-ayuda`
  return (
    <div className={className}>
      <label htmlFor={idCampo} className="mb-1.5 block text-sm font-medium text-stone-700">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          id={idCampo}
          aria-invalid={error ? true : undefined}
          aria-describedby={ayuda || error ? idAyuda : undefined}
          className={cx(
            'block min-h-12 w-full rounded-xl border bg-white px-3.5 text-stone-900 placeholder:text-stone-400',
            'focus:border-marca-600 focus:outline-none focus:ring-2 focus:ring-marca-600/20',
            error ? 'border-red-400' : 'border-stone-300',
            accesorio ? 'pr-12' : undefined,
          )}
          {...props}
        />
        {accesorio && <div className="absolute inset-y-0 right-0 flex items-center pr-1">{accesorio}</div>}
      </div>
      {(error || ayuda) && (
        <p id={idAyuda} className={cx('mt-1.5 text-sm', error ? 'text-red-700' : 'text-stone-500')}>
          {error || ayuda}
        </p>
      )}
    </div>
  )
}

type TipoAviso = 'info' | 'exito' | 'aviso' | 'error'

const ESTILO_AVISO: Record<TipoAviso, { clase: string; icono: LucideIcon }> = {
  info: { clase: 'bg-sky-50 text-sky-900 ring-sky-200', icono: Info },
  exito: { clase: 'bg-marca-50 text-marca-900 ring-marca-200', icono: CircleCheck },
  aviso: { clase: 'bg-amber-50 text-amber-900 ring-amber-200', icono: TriangleAlert },
  error: { clase: 'bg-red-50 text-red-900 ring-red-200', icono: TriangleAlert },
}

export function Aviso({ tipo = 'info', titulo, children, className }: {
  tipo?: TipoAviso
  titulo?: string
  children?: ReactNode
  className?: string
}) {
  const { clase, icono: Icono } = ESTILO_AVISO[tipo]
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-xl p-3.5 ring-1', clase, className)}>
      <Icono className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 text-sm leading-relaxed">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children}
      </div>
    </div>
  )
}

export function Tarjeta({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl bg-white shadow-sm ring-1 ring-stone-200', className)}>{children}</div>
}

/** Fila pulsable dentro de una tarjeta (menús, listados). */
export function FilaEnlace({ a, icono: Icono, titulo, detalle, derecha }: {
  a: string
  icono?: LucideIcon
  titulo: string
  detalle?: ReactNode
  derecha?: ReactNode
}) {
  return (
    <Link to={a} className="flex min-h-14 items-center gap-3 px-4 py-3 transition hover:bg-stone-50 active:bg-stone-100">
      {Icono && (
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-marca-50 text-marca-700">
          <Icono className="size-5" aria-hidden />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-stone-900">{titulo}</span>
        {detalle && <span className="block truncate text-sm text-stone-500">{detalle}</span>}
      </span>
      {derecha}
    </Link>
  )
}

export function Insignia({ children, color = 'gris' }: { children: ReactNode; color?: 'gris' | 'marca' | 'ambar' | 'rojo' }) {
  const estilos = {
    gris: 'bg-stone-100 text-stone-700',
    marca: 'bg-marca-100 text-marca-800',
    ambar: 'bg-amber-100 text-amber-800',
    rojo: 'bg-red-100 text-red-800',
  }
  return (
    <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', estilos[color])}>
      {children}
    </span>
  )
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-stone-500">
      <LoaderCircle className="size-8 animate-spin text-marca-600" aria-hidden />
      <span className="text-sm">{texto}</span>
    </div>
  )
}

export function Vacio({ icono: Icono, titulo, children, accion }: {
  icono: LucideIcon
  titulo: string
  children?: ReactNode
  accion?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 grid size-16 place-items-center rounded-2xl bg-marca-50 text-marca-700">
        <Icono className="size-8" aria-hidden />
      </span>
      <h2 className="text-lg font-semibold text-stone-900">{titulo}</h2>
      {children && <div className="mt-2 max-w-sm text-sm leading-relaxed text-stone-600">{children}</div>}
      {accion && <div className="mt-6">{accion}</div>}
    </div>
  )
}
