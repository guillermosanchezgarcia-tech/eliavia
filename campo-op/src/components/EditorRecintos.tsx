import { Crosshair, LoaderCircle, Plus, Search, Trash, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { nombreUsoSigpac } from '../lib/catalogos'
import { PROVINCIA_ALMERIA, PROVINCIAS } from '../lib/codigosSigpac'
import { cx } from '../lib/cx'
import { formatearHa } from '../lib/formato'
import { obtenerPosicion, textoPrecision } from '../lib/gps'
import { silueta } from '../lib/geometria'
import {
  buscarRecintos,
  claveRecinto,
  ErrorSigpac,
  municipiosDe,
  nombreMunicipio,
  nombreProvincia,
  recintoEnPunto,
  textoReferencia,
  type RecintoBorrador,
  type RecintoSigpac,
} from '../lib/sigpac'
import { parsearNumero } from '../lib/formato'
import { useConexion } from '../hooks/useConexion'
import { Aviso, Boton, Campo, Dialogo, Seleccion } from './ui'

export function Silueta({ geometria, className }: { geometria: RecintoSigpac['geometria']; className?: string }) {
  const d = silueta(geometria)
  return (
    <svg viewBox="0 0 100 100" className={cx('shrink-0 rounded-lg bg-marca-50', className)} aria-hidden>
      {d ? (
        <path d={d} fill="#bbf7d0" stroke="#15803d" strokeWidth="2.5" strokeLinejoin="round" fillRule="evenodd" />
      ) : (
        <rect x="30" y="30" width="40" height="40" rx="4" fill="none" stroke="#a8a29e" strokeDasharray="4 4" strokeWidth="2" />
      )}
    </svg>
  )
}

export function EditorRecintos({ recintos, onChange, alObtenerPosicion }: {
  recintos: RecintoBorrador[]
  onChange: (recintos: RecintoBorrador[]) => void
  /** Se llama con la posición cuando se usa «desde mi posición». */
  alObtenerPosicion?: (latitud: number, longitud: number) => void
}) {
  const [dialogo, setDialogo] = useState<'referencia' | 'posicion' | null>(null)
  const conexion = useConexion()

  function añadir(nuevos: RecintoSigpac[]) {
    const ya = new Set(recintos.map(claveRecinto))
    const aAñadir = nuevos
      .filter((r) => !ya.has(claveRecinto(r)))
      .map((r) => ({ ...r, clave: crypto.randomUUID(), existente: false }))
    if (aAñadir.length) onChange([...recintos, ...aAñadir])
    return aAñadir.length
  }

  return (
    <div className="space-y-3">
      {recintos.length === 0 ? (
        <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-600">
          Todavía no hay recintos. Añade la referencia SIGPAC de la finca: se rellenan solos la superficie, el uso y el contorno.
        </p>
      ) : (
        <ul className="space-y-2">
          {recintos.map((r) => (
            <li key={r.clave} className="flex items-center gap-3 rounded-xl bg-stone-50 p-2.5">
              <Silueta geometria={r.geometria} className="size-14" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold text-stone-900">{textoReferencia(r)}</p>
                <p className="truncate text-stone-600">
                  {nombreMunicipio(r.provincia, r.municipio)}
                  {r.provincia !== PROVINCIA_ALMERIA && ` (${nombreProvincia(r.provincia)})`}
                </p>
                <p className="truncate text-stone-500">
                  {[r.superficie_ha !== null ? formatearHa(r.superficie_ha, 4) : null, nombreUsoSigpac(r.uso_sigpac)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChange(recintos.filter((x) => x.clave !== r.clave))}
                className="grid size-11 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-700"
                aria-label={`Quitar ${textoReferencia(r)}`}
              >
                <Trash className="size-5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!conexion && (
        <Aviso tipo="aviso">
          Sin conexión no se puede consultar el SIGPAC. Puedes guardar la finca ahora y añadir los recintos más tarde.
        </Aviso>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Boton variante="secundario" icono={Search} disabled={!conexion} onClick={() => setDialogo('referencia')}>
          Por referencia
        </Boton>
        <Boton variante="secundario" icono={Crosshair} disabled={!conexion} onClick={() => setDialogo('posicion')}>
          Mi posición
        </Boton>
      </div>

      <BuscarPorReferencia abierto={dialogo === 'referencia'} alCerrar={() => setDialogo(null)} onAñadir={añadir} />
      <BuscarPorPosicion
        abierto={dialogo === 'posicion'}
        alCerrar={() => setDialogo(null)}
        onAñadir={añadir}
        alObtenerPosicion={alObtenerPosicion}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------

function ListaResultados({ resultados, elegidos, onAlternar }: {
  resultados: RecintoSigpac[]
  elegidos: Set<number>
  onAlternar: (recinto: number) => void
}) {
  return (
    <ul className="space-y-2">
      {resultados.map((r) => {
        const marcado = elegidos.has(r.recinto)
        return (
          <li key={r.recinto}>
            <button
              type="button"
              role="checkbox"
              aria-checked={marcado}
              onClick={() => onAlternar(r.recinto)}
              className={cx(
                'flex w-full items-center gap-3 rounded-xl p-2.5 text-left ring-1 transition',
                marcado ? 'bg-marca-50 ring-marca-600' : 'bg-white ring-stone-200 hover:bg-stone-50',
              )}
            >
              <Silueta geometria={r.geometria} className="size-14" />
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-semibold text-stone-900">Recinto {r.recinto}</span>
                <span className="block text-stone-600">{formatearHa(r.superficie_ha, 4)}</span>
                <span className="block truncate text-stone-500">{nombreUsoSigpac(r.uso_sigpac) || 'Sin uso'}</span>
              </span>
              <span
                className={cx(
                  'grid size-6 shrink-0 place-items-center rounded-md ring-1',
                  marcado ? 'bg-marca-700 text-white ring-marca-700' : 'bg-white ring-stone-300',
                )}
                aria-hidden
              >
                {marcado && <Plus className="size-4 rotate-45" strokeWidth={3} />}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function BuscarPorReferencia({ abierto, alCerrar, onAñadir }: {
  abierto: boolean
  alCerrar: () => void
  onAñadir: (r: RecintoSigpac[]) => number
}) {
  const [provincia, setProvincia] = useState(PROVINCIA_ALMERIA)
  const [municipios, setMunicipios] = useState<[number, string][]>([])
  const [municipio, setMunicipio] = useState('')
  const [poligono, setPoligono] = useState('')
  const [parcela, setParcela] = useState('')
  const [recinto, setRecinto] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultados, setResultados] = useState<RecintoSigpac[] | null>(null)
  const [elegidos, setElegidos] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!abierto) return
    let vigente = true
    municipiosDe(provincia)
      .then((l) => vigente && setMunicipios([...l].sort((a, b) => a[1].localeCompare(b[1], 'es'))))
      .catch((e) => vigente && (setMunicipios([]), setError(e instanceof Error ? e.message : String(e))))
    return () => {
      vigente = false
    }
  }, [abierto, provincia])

  function cerrar() {
    setResultados(null)
    setError(null)
    alCerrar()
  }

  const nPol = parsearNumero(poligono)
  const nParc = parsearNumero(parcela)
  const nRec = recinto.trim() ? parsearNumero(recinto) : null
  const valido = Boolean(municipio) && nPol !== null && nPol >= 0 && nParc !== null && nParc >= 0 && (!recinto.trim() || nRec !== null)

  async function buscar() {
    if (!valido) return
    setBuscando(true)
    setError(null)
    setResultados(null)
    try {
      const r = await buscarRecintos({
        provincia,
        municipio: Number(municipio),
        agregado: 0,
        zona: 0,
        poligono: nPol!,
        parcela: nParc!,
        recinto: nRec,
      })
      if (!r.length) setError('El SIGPAC no tiene esa referencia. Comprueba el municipio, el polígono y la parcela.')
      setResultados(r)
      // Si se pidió un recinto concreto, ya viene marcado; si no, hay que elegir.
      setElegidos(new Set(nRec !== null || r.length === 1 ? r.map((x) => x.recinto) : []))
    } catch (e) {
      setError(e instanceof ErrorSigpac ? e.message : 'No se ha podido consultar el SIGPAC.')
    } finally {
      setBuscando(false)
    }
  }

  function añadir() {
    const n = onAñadir((resultados ?? []).filter((r) => elegidos.has(r.recinto)))
    if (n === 0) setError('Estos recintos ya estaban añadidos.')
    else cerrar()
  }

  return (
    <Dialogo
      abierto={abierto}
      titulo="Buscar en el SIGPAC"
      alCerrar={cerrar}
      acciones={
        resultados?.length ? (
          <>
            <Boton variante="secundario" onClick={() => setResultados(null)}>
              Nueva búsqueda
            </Boton>
            <Boton icono={Plus} disabled={elegidos.size === 0} onClick={añadir}>
              Añadir {elegidos.size || ''} {elegidos.size === 1 ? 'recinto' : 'recintos'}
            </Boton>
          </>
        ) : (
          <>
            <Boton variante="secundario" onClick={cerrar}>
              Cancelar
            </Boton>
            <Boton icono={Search} cargando={buscando} disabled={!valido} onClick={() => void buscar()}>
              Buscar
            </Boton>
          </>
        )
      }
    >
      {resultados?.length ? (
        <div className="space-y-3">
          <p>
            {resultados.length === 1 ? 'Se ha encontrado 1 recinto.' : `La parcela tiene ${resultados.length} recintos. Marca los de esta finca.`}
          </p>
          <ListaResultados
            resultados={resultados}
            elegidos={elegidos}
            onAlternar={(n) =>
              setElegidos((e) => {
                const nuevo = new Set(e)
                if (!nuevo.delete(n)) nuevo.add(n)
                return nuevo
              })
            }
          />
          {error && <Aviso tipo="error">{error}</Aviso>}
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void buscar()
          }}
        >
          <Seleccion
            etiqueta="Provincia"
            value={String(provincia)}
            onChange={(e) => {
              setProvincia(Number(e.target.value))
              setMunicipio('')
            }}
            opciones={PROVINCIAS.map(([c, n]) => ({ valor: String(c), texto: n }))}
          />
          <Seleccion
            etiqueta="Municipio"
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            vacia={municipios.length ? 'Elegir municipio…' : 'Cargando…'}
            opciones={municipios.map(([c, n]) => ({ valor: String(c), texto: n }))}
          />
          <div className="grid grid-cols-3 gap-3">
            <Campo etiqueta="Polígono" inputMode="numeric" value={poligono} onChange={(e) => setPoligono(e.target.value)} autoComplete="off" />
            <Campo etiqueta="Parcela" inputMode="numeric" value={parcela} onChange={(e) => setParcela(e.target.value)} autoComplete="off" />
            <Campo etiqueta="Recinto" inputMode="numeric" value={recinto} onChange={(e) => setRecinto(e.target.value)} autoComplete="off" placeholder="Todos" />
          </div>
          <p className="text-xs text-stone-500">Si dejas el recinto vacío, verás todos los recintos de la parcela.</p>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <button type="submit" className="hidden" />
        </form>
      )}
    </Dialogo>
  )
}

// ---------------------------------------------------------------------------

function BuscarPorPosicion({ abierto, alCerrar, onAñadir, alObtenerPosicion }: {
  abierto: boolean
  alCerrar: () => void
  onAñadir: (r: RecintoSigpac[]) => number
  alObtenerPosicion?: (latitud: number, longitud: number) => void
}) {
  const [estado, setEstado] = useState<'buscando' | 'listo' | 'error'>('buscando')
  const [error, setError] = useState<string | null>(null)
  const [encontrado, setEncontrado] = useState<RecintoSigpac | null>(null)
  const [precision, setPrecision] = useState(0)
  const [intento, setIntento] = useState(0)
  // Se guarda aparte para que un cambio de esta función no repita la búsqueda.
  const avisarPosicion = useRef(alObtenerPosicion)
  useEffect(() => {
    avisarPosicion.current = alObtenerPosicion
  })

  useEffect(() => {
    if (!abierto) return
    let vigente = true
    ;(async () => {
      try {
        setEstado('buscando')
        const p = await obtenerPosicion()
        const r = await recintoEnPunto(p.latitud, p.longitud)
        if (!vigente) return
        setPrecision(p.precision)
        setEncontrado(r)
        setEstado('listo')
        avisarPosicion.current?.(p.latitud, p.longitud)
      } catch (e) {
        if (!vigente) return
        setError(e instanceof Error ? e.message : String(e))
        setEstado('error')
      }
    })()
    return () => {
      vigente = false
    }
  }, [abierto, intento])

  return (
    <Dialogo
      abierto={abierto}
      titulo="Recinto en mi posición"
      alCerrar={alCerrar}
      acciones={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            {estado === 'listo' && encontrado ? 'Cancelar' : 'Cerrar'}
          </Boton>
          {estado === 'listo' && encontrado ? (
            <Boton
              icono={Plus}
              onClick={() => {
                onAñadir([encontrado])
                alCerrar()
              }}
            >
              Añadir recinto
            </Boton>
          ) : (
            estado !== 'buscando' && (
              <Boton icono={Crosshair} onClick={() => setIntento((n) => n + 1)}>
                Reintentar
              </Boton>
            )
          )}
        </>
      }
    >
      {estado === 'buscando' && (
        <p className="flex items-center gap-3 py-4">
          <LoaderCircle className="size-6 animate-spin text-marca-600" aria-hidden />
          Obteniendo tu posición…
        </p>
      )}
      {estado === 'error' && <Aviso tipo="error">{error}</Aviso>}
      {estado === 'listo' && !encontrado && (
        <Aviso tipo="aviso" titulo="No hay recinto SIGPAC aquí">
          La posición obtenida ({textoPrecision(precision)}) no cae dentro de ningún recinto. Acércate más al centro de la finca o búscalo por referencia.
        </Aviso>
      )}
      {estado === 'listo' && encontrado && (
        <div className="space-y-3">
          <p>
            Estás dentro de este recinto <span className="text-stone-500">(precisión {textoPrecision(precision)})</span>:
          </p>
          <div className="flex items-center gap-3 rounded-xl bg-marca-50 p-2.5 ring-1 ring-marca-600">
            <Silueta geometria={encontrado.geometria} className="size-16" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-stone-900">{textoReferencia(encontrado)}</p>
              <p className="text-stone-600">{nombreMunicipio(encontrado.provincia, encontrado.municipio)}</p>
              <p className="text-stone-500">
                {[formatearHa(encontrado.superficie_ha, 4), nombreUsoSigpac(encontrado.uso_sigpac)].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          {precision > 30 && (
            <p className="flex gap-2 text-amber-800">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              La precisión es baja: comprueba que es el recinto correcto antes de añadirlo.
            </p>
          )}
        </div>
      )}
    </Dialogo>
  )
}
