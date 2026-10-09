// Piezas de interfaz reutilizables: botones, campos de formulario, avisos…
// Todas tienen un tamaño mínimo de 48 px para poder pulsarlas con el pulgar.

import {
  Check,
  CircleCheck,
  Info,
  LoaderCircle,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import {
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Link } from 'react-router'
import { cx } from '../lib/cx'

type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'eliminar' | 'fantasma'

const ESTILO_BOTON: Record<VarianteBoton, string> = {
  primario: 'bg-marca-700 text-white shadow-sm hover:bg-marca-800 active:bg-marca-900',
  secundario: 'bg-white text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50 active:bg-stone-100',
  peligro: 'bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50 active:bg-red-100',
  eliminar: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800',
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

interface PropsAreaTexto extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  etiqueta: string
  ayuda?: ReactNode
}

export function AreaTexto({ etiqueta, ayuda, className, id, ...props }: PropsAreaTexto) {
  const idAuto = useId()
  const idCampo = id ?? idAuto
  return (
    <div className={className}>
      <label htmlFor={idCampo} className="mb-1.5 block text-sm font-medium text-stone-700">
        {etiqueta}
      </label>
      <textarea
        id={idCampo}
        rows={4}
        className="block w-full rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-stone-900 placeholder:text-stone-400 focus:border-marca-600 focus:ring-2 focus:ring-marca-600/20 focus:outline-none"
        {...props}
      />
      {ayuda && <p className="mt-1.5 text-sm text-stone-500">{ayuda}</p>}
    </div>
  )
}

/** Botones tipo «píldora» para elegir una opción entre pocas (p. ej. Activo / Baja). */
export function Opciones<T extends string>({ etiqueta, opciones, valor, onChange, className }: {
  etiqueta: string
  opciones: { valor: T; texto: string; cuenta?: number }[]
  valor: T
  onChange: (valor: T) => void
  className?: string
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className={cx('flex gap-2 overflow-x-auto', className)}>
      {opciones.map((o) => {
        const elegida = o.valor === valor
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={elegida}
            onClick={() => onChange(o.valor)}
            className={cx(
              'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium ring-1 transition',
              elegida
                ? 'bg-marca-700 text-white ring-marca-700'
                : 'bg-white text-stone-700 ring-stone-300 hover:bg-stone-50',
            )}
          >
            {o.texto}
            {o.cuenta !== undefined && (
              <span className={cx('hidden tabular-nums sm:inline', elegida ? 'text-marca-100' : 'text-stone-400')}>
                {o.cuenta}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Botón redondo flotante abajo a la derecha (zona del pulgar) para «añadir». */
export function BotonFlotante({ a, icono: Icono, texto }: { a: string; icono: LucideIcon; texto: string }) {
  return (
    <Link
      to={a}
      className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 inline-flex h-14 items-center gap-2 rounded-2xl bg-marca-700 pr-5 pl-4 font-semibold text-white shadow-lg shadow-marca-900/20 transition hover:bg-marca-800 active:scale-95 lg:right-8 lg:bottom-8"
    >
      <Icono className="size-6" aria-hidden />
      {texto}
    </Link>
  )
}

/**
 * Ventana de confirmación. En el móvil sale desde abajo (al alcance del
 * pulgar) y en el ordenador, centrada.
 */
export function Dialogo({ abierto, titulo, children, acciones, alCerrar }: {
  abierto: boolean
  titulo: string
  children?: ReactNode
  acciones: ReactNode
  alCerrar: () => void
}) {
  const idTitulo = useId()
  useEffect(() => {
    if (!abierto) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [abierto, alCerrar])

  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-stone-900/40" onClick={alCerrar} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className="pb-seguro relative max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl sm:pb-5"
      >
        <h2 id={idTitulo} className="text-lg font-bold text-stone-900">
          {titulo}
        </h2>
        {children && <div className="mt-2 text-sm leading-relaxed text-stone-600">{children}</div>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{acciones}</div>
      </div>
    </div>
  )
}

/** Enlace con aspecto de botón (para ir a otra pantalla). */
export function EnlaceBoton({ a, variante = 'primario', icono: Icono, bloque = false, className, children }: {
  a: string
  variante?: VarianteBoton
  icono?: LucideIcon
  bloque?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <Link to={a} className={cx(BASE_BOTON, ESTILO_BOTON[variante], bloque && 'w-full', className)}>
      {Icono && <Icono className="size-5" aria-hidden />}
      {children}
    </Link>
  )
}

interface PropsSeleccion extends SelectHTMLAttributes<HTMLSelectElement> {
  etiqueta: string
  ayuda?: ReactNode
  error?: string | null
  opciones: { valor: string; texto: string }[]
  /** Texto de la opción vacía; sin él no hay opción vacía. */
  vacia?: string
}

/** Desplegable nativo (en el móvil abre el selector del sistema, cómodo con el pulgar). */
export function Seleccion({ etiqueta, ayuda, error, opciones, vacia, className, id, ...props }: PropsSeleccion) {
  const idAuto = useId()
  const idCampo = id ?? idAuto
  return (
    <div className={className}>
      <label htmlFor={idCampo} className="mb-1.5 block text-sm font-medium text-stone-700">
        {etiqueta}
      </label>
      <select
        id={idCampo}
        aria-invalid={error ? true : undefined}
        className={cx(
          'block min-h-12 w-full rounded-xl border bg-white px-3 text-stone-900 focus:border-marca-600 focus:ring-2 focus:ring-marca-600/20 focus:outline-none',
          error ? 'border-red-400' : 'border-stone-300',
        )}
        {...props}
      >
        {vacia !== undefined && <option value="">{vacia}</option>}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
      {(error || ayuda) && <p className={cx('mt-1.5 text-sm', error ? 'text-red-700' : 'text-stone-500')}>{error || ayuda}</p>}
    </div>
  )
}

/** Botón que se marca y desmarca (varias a la vez, p. ej. las certificaciones). */
export function Etiqueta({ marcada, onClick, children }: { marcada: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      onClick={onClick}
      className={cx(
        'inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium ring-1 transition',
        marcada ? 'bg-marca-700 text-white ring-marca-700' : 'bg-white text-stone-700 ring-stone-300 hover:bg-stone-50',
      )}
    >
      {marcada && <Check className="size-4" aria-hidden />}
      {children}
    </button>
  )
}

/** Bloque de un formulario con su título: «Identificación», «Contacto»… */
export function GrupoFormulario({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    // «min-w-0»: por defecto un fieldset se ensancha hasta el contenido más ancho y desborda la pantalla.
    <fieldset className="min-w-0">
      <legend className="mb-2 px-1 text-sm font-semibold tracking-wide text-stone-500 uppercase">{titulo}</legend>
      <Tarjeta className="space-y-4 p-4">{children}</Tarjeta>
    </fieldset>
  )
}

/** Barra con el botón de guardar, siempre a la vista al final del formulario. */
export function BarraGuardar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-4 bg-gradient-to-t from-fondo via-fondo to-fondo/0 px-4 pt-4 pb-3 lg:bottom-0">
      {children}
    </div>
  )
}
