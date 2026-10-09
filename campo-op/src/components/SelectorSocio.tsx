import { ChevronsUpDown, Search, UserX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSocios } from '../datos/consultas'
import { coincide, comparar } from '../lib/formato'
import { cx } from '../lib/cx'
import { Boton, Dialogo } from './ui'

const MAXIMO = 40

/**
 * Elegir un socio entre cientos: un botón que abre una ventana con buscador.
 * (Un desplegable normal sería inmanejable con tantos socios.)
 */
export function SelectorSocio({ valor, onChange, error, etiqueta = 'Socio *' }: {
  valor: string
  onChange: (idSocio: string) => void
  error?: string | null
  etiqueta?: string
}) {
  const socios = useSocios()
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const elegido = socios?.find((s) => s.id === valor)

  const resultado = useMemo(() => {
    const activos = (socios ?? []).filter((s) => s.estado === 'activo' || s.id === valor)
    const lista = busqueda ? activos.filter((s) => coincide(`${s.codigo} ${s.nombre} ${s.nif ?? ''}`, busqueda)) : activos
    return lista.sort((a, b) => comparar(a.nombre, b.nombre))
  }, [socios, busqueda, valor])

  function cerrar() {
    setAbierto(false)
    setBusqueda('')
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-stone-700">{etiqueta}</p>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-invalid={error ? true : undefined}
        className={cx(
          'flex min-h-12 w-full items-center gap-2 rounded-xl border bg-white px-3.5 text-left focus:border-marca-600 focus:ring-2 focus:ring-marca-600/20 focus:outline-none',
          error ? 'border-red-400' : 'border-stone-300',
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {elegido ? (
            <>
              <span className="font-medium text-stone-900">{elegido.nombre}</span>
              <span className="text-stone-500"> · {elegido.codigo}</span>
            </>
          ) : (
            <span className="text-stone-400">Elegir socio…</span>
          )}
        </span>
        <ChevronsUpDown className="size-5 shrink-0 text-stone-400" aria-hidden />
      </button>
      {error && <p className="mt-1.5 text-sm text-red-700">{error}</p>}

      <Dialogo
        abierto={abierto}
        titulo="Elegir socio"
        alCerrar={cerrar}
        acciones={
          <Boton variante="secundario" onClick={cerrar}>
            Cancelar
          </Boton>
        }
      >
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-stone-400" aria-hidden />
          <input
            type="search"
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre, código o NIF"
            aria-label="Buscar socio"
            className="block min-h-12 w-full rounded-xl border border-stone-300 bg-white pr-3 pl-11 text-stone-900 focus:border-marca-600 focus:ring-2 focus:ring-marca-600/20 focus:outline-none"
          />
        </div>
        {resultado.length === 0 ? (
          <p className="flex items-center gap-2 py-6 text-stone-500">
            <UserX className="size-5" aria-hidden />
            Ningún socio activo coincide.
          </p>
        ) : (
          <ul className="-mx-2 max-h-[45dvh] overflow-y-auto">
            {resultado.slice(0, MAXIMO).map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(s.id)
                    cerrar()
                  }}
                  className={cx(
                    'flex min-h-14 w-full flex-col justify-center rounded-xl px-3 text-left hover:bg-stone-50 active:bg-stone-100',
                    s.id === valor && 'bg-marca-50',
                  )}
                >
                  <span className="font-medium text-stone-900">{s.nombre}</span>
                  <span className="text-sm text-stone-500">
                    Cód. {s.codigo}
                    {s.localidad && ` · ${s.localidad}`}
                  </span>
                </button>
              </li>
            ))}
            {resultado.length > MAXIMO && (
              <li className="px-3 py-3 text-sm text-stone-500">Hay {resultado.length - MAXIMO} más. Escribe para afinar la búsqueda.</li>
            )}
          </ul>
        )}
      </Dialogo>
    </div>
  )
}
