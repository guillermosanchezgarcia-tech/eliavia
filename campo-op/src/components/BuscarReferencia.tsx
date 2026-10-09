import { Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { nombreUsoSigpac } from '../lib/catalogos'
import { PROVINCIA_ALMERIA, PROVINCIAS } from '../lib/codigosSigpac'
import { cx } from '../lib/cx'
import { formatearHa, parsearNumero } from '../lib/formato'
import { buscarRecintos, ErrorSigpac, municipiosDe, type RecintoSigpac } from '../lib/sigpac'
import { Silueta } from './Silueta'
import { Aviso, Boton, Campo, Dialogo, Seleccion } from './ui'

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

export function DialogoBuscarReferencia({ abierto, alCerrar, onElegir, titulo = 'Buscar en el SIGPAC', accion = 'Añadir', marcarTodos = false }: {
  abierto: boolean
  alCerrar: () => void
  /** Recibe los recintos marcados. Devuelve cuántos se han aceptado (0 = no se cierra y se avisa). */
  onElegir: (r: RecintoSigpac[]) => number
  titulo?: string
  /** Verbo del botón final: «Añadir», «Ver en el mapa»… */
  accion?: string
  /** Si es true, al encontrar varios recintos vienen todos marcados. */
  marcarTodos?: boolean
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
      setElegidos(new Set(nRec !== null || r.length === 1 || marcarTodos ? r.map((x) => x.recinto) : []))
    } catch (e) {
      setError(e instanceof ErrorSigpac ? e.message : 'No se ha podido consultar el SIGPAC.')
    } finally {
      setBuscando(false)
    }
  }

  function añadir() {
    const n = onElegir((resultados ?? []).filter((r) => elegidos.has(r.recinto)))
    if (n === 0) setError('Estos recintos ya estaban añadidos.')
    else cerrar()
  }

  return (
    <Dialogo
      abierto={abierto}
      titulo={titulo}
      alCerrar={cerrar}
      acciones={
        resultados?.length ? (
          <>
            <Boton variante="secundario" onClick={() => setResultados(null)}>
              Nueva búsqueda
            </Boton>
            <Boton icono={Plus} disabled={elegidos.size === 0} onClick={añadir}>
              {accion} {elegidos.size || ''} {elegidos.size === 1 ? 'recinto' : 'recintos'}
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
