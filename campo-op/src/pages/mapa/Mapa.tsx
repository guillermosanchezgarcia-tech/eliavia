import { Layers, LoaderCircle, LocateFixed, Minus, Plus, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { DialogoBuscarReferencia } from '../../components/BuscarReferencia'
import { IndicadorSincronizacion } from '../../components/IndicadorSincronizacion'
import { Etiqueta, Opciones } from '../../components/ui'
import { useFincas, useRecintos, useSocios } from '../../datos/consultas'
import { useConexion } from '../../hooks/useConexion'
import { useCriteriosFincas } from '../../hooks/useCriteriosFincas'
import { cx } from '../../lib/cx'
import { construirTextos, filtrarFincas, hayFiltros } from '../../lib/fincas'
import { mensajeDeError } from '../../lib/errores'
import { obtenerPosicion, type Posicion } from '../../lib/gps'
import { ErrorSigpac, recintoEnPunto, type RecintoSigpac } from '../../lib/sigpac'
import { NOMBRES_BASE, ZOOM_CONSULTA, type BaseMapa } from '../../mapa/capas'
import { limitesDe, prepararFincas, unirLimites } from '../../mapa/datos'
import { MapaLeaflet, type Ajuste, type PosicionMapa, type Resaltado } from '../../mapa/MapaLeaflet'
import { TarjetaFinca, TarjetaRecintos } from './TarjetasMapa'

const CLAVE_CAPAS = 'campo-op:mapa:capas'
const CLAVE_VISTA = 'campo-op:mapa:vista'

interface Capas {
  base: BaseMapa
  sigpac: boolean
  fincas: boolean
}
interface Vista {
  centro: [number, number]
  zoom: number
}

function leer<T>(clave: string): T | null {
  try {
    const texto = localStorage.getItem(clave)
    return texto ? (JSON.parse(texto) as T) : null
  } catch {
    return null
  }
}
function guardar(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor))
  } catch {
    // Sin almacenamiento (modo privado): simplemente no se recuerda.
  }
}

type Seleccion = { tipo: 'finca'; id: string } | { tipo: 'recintos'; recintos: RecintoSigpac[]; activo: number }

export function Mapa() {
  const [parametros, setParametros] = useSearchParams()
  const fincaParam = parametros.get('finca')
  const querPosicion = parametros.get('pos') === '1'
  const conexion = useConexion()
  const criterios = useCriteriosFincas()
  const filtrando = hayFiltros(criterios)

  const fincas = useFincas()
  const recintos = useRecintos()
  const socios = useSocios()
  const listo = fincas !== undefined && recintos !== undefined && socios !== undefined

  // ---- Datos que se dibujan --------------------------------------------------
  const textos = useMemo(() => construirTextos(fincas ?? [], recintos ?? [], socios ?? []), [fincas, recintos, socios])
  const nombresSocio = useMemo(() => new Map((socios ?? []).map((s) => [s.id, s.nombre])), [socios])
  const filtradas = useMemo(
    () => (listo ? filtrarFincas(fincas, textos, nombresSocio, criterios) : []),
    [listo, fincas, textos, nombresSocio, criterios],
  )
  const datos = useMemo(() => (listo ? prepararFincas(filtradas, recintos, socios) : []), [listo, filtradas, recintos, socios])
  const limitesIniciales = useMemo(() => {
    if (!listo) return null
    const suya = fincaParam ? datos.find((d) => d.id === fincaParam)?.limites : null
    return suya ?? unirLimites(datos.map((d) => d.limites))
  }, [listo, datos, fincaParam])

  // ---- Estado del mapa ---------------------------------------------------------
  const [capas, setCapas] = useState<Capas>(
    () =>
      leer<Capas>(CLAVE_CAPAS) ?? {
        base: 'ortofoto',
        sigpac: true,
        fincas: true,
      },
  )
  const [vistaGuardada] = useState<Vista | null>(() => (fincaParam || querPosicion ? null : leer<Vista>(CLAVE_VISTA)))
  const [seleccion, setSeleccion] = useState<Seleccion | null>(fincaParam ? { tipo: 'finca', id: fincaParam } : null)
  const [posicion, setPosicion] = useState<PosicionMapa | null>(null)
  const [ajuste, setAjuste] = useState<Ajuste | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  // Si se abre con «?pos=1» (desde «¿Dónde estoy?» del inicio), ya está localizando.
  const [localizando, setLocalizando] = useState(querPosicion)
  const [consultando, setConsultando] = useState(false)
  const [panelCapas, setPanelCapas] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const consulta = useRef(0)
  const guardadoVista = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function cambiarCapas(cambio: Partial<Capas>) {
    const nuevas = { ...capas, ...cambio }
    setCapas(nuevas)
    guardar(CLAVE_CAPAS, nuevas)
  }

  const mover = useCallback((cambio: Omit<Ajuste, 'clave'>) => {
    setAjuste((previo) => ({ ...cambio, clave: (previo?.clave ?? 0) + 1 }))
  }, [])

  useEffect(() => {
    if (!aviso) return
    const temporizador = setTimeout(() => setAviso(null), 6000)
    return () => clearTimeout(temporizador)
  }, [aviso])

  // ---- Acciones -------------------------------------------------------------
  const mostrarRecintos = useCallback(
    (encontrados: RecintoSigpac[], acercar: boolean) => {
      setSeleccion({ tipo: 'recintos', recintos: encontrados, activo: 0 })
      if (acercar) {
        const limites = limitesDe(encontrados.map((r) => r.geometria).filter((g) => g !== null))
        if (limites) mover({ limites })
      }
    },
    [mover],
  )

  /** Devuelve el recinto, `null` si ahí no hay ninguno, o `undefined` si ya se ha hecho otra consulta después. */
  const consultarSigpac = useCallback(async (latitud: number, longitud: number) => {
    const numero = ++consulta.current
    setConsultando(true)
    try {
      const r = await recintoEnPunto(latitud, longitud)
      return numero === consulta.current ? r : undefined
    } finally {
      if (numero === consulta.current) setConsultando(false)
    }
  }, [])

  // Cuando llega la posición del GPS: se marca en el mapa y se consulta el recinto en el que estás.
  const alRecibirPosicion = useCallback(
    async (p: Posicion) => {
      try {
        setPosicion(p)
        mover({ centro: [p.latitud, p.longitud], zoom: 18 })
        if (!navigator.onLine) {
          setAviso('Sin conexión: se ve dónde estás, pero el recinto SIGPAC solo se puede consultar con cobertura.')
          return
        }
        const r = await consultarSigpac(p.latitud, p.longitud)
        if (r) mostrarRecintos([r], false)
        else if (r === null) {
          setSeleccion(null)
          setAviso('Tu posición no cae dentro de ningún recinto del SIGPAC.')
        }
      } catch (e) {
        setAviso(e instanceof ErrorSigpac ? e.message : mensajeDeError(e))
      } finally {
        setLocalizando(false)
      }
    },
    [consultarSigpac, mostrarRecintos, mover],
  )
  const alFallarPosicion = useCallback((e: unknown) => {
    setAviso(e instanceof Error ? e.message : mensajeDeError(e))
    setLocalizando(false)
  }, [])

  useEffect(() => {
    if (querPosicion) obtenerPosicion().then(alRecibirPosicion, alFallarPosicion)
  }, [querPosicion, alRecibirPosicion, alFallarPosicion])

  function pulsarMiPosicion() {
    setLocalizando(true)
    setAviso(null)
    obtenerPosicion().then(alRecibirPosicion, alFallarPosicion)
  }

  const alTocar = useCallback(
    async (latitud: number, longitud: number, zoom: number) => {
      setPanelCapas(false)
      if (zoom < ZOOM_CONSULTA) {
        setSeleccion(null)
        setAviso('Acerca el mapa para tocar un recinto y ver su referencia SIGPAC.')
        return
      }
      if (!navigator.onLine) {
        setSeleccion(null)
        setAviso('Sin conexión: el SIGPAC solo se puede consultar con cobertura.')
        return
      }
      try {
        const r = await consultarSigpac(latitud, longitud)
        if (r) mostrarRecintos([r], false)
        else if (r === null) {
          setSeleccion(null)
          setAviso('Ahí no hay ningún recinto SIGPAC.')
        }
      } catch (e) {
        setAviso(e instanceof ErrorSigpac ? e.message : mensajeDeError(e))
      }
    },
    [consultarSigpac, mostrarRecintos],
  )

  const alElegirFinca = useCallback((id: string) => {
    consulta.current++
    setConsultando(false)
    setPanelCapas(false)
    setSeleccion({ tipo: 'finca', id })
  }, [])

  const alMoverVista = useCallback((centro: [number, number], zoom: number) => {
    clearTimeout(guardadoVista.current)
    guardadoVista.current = setTimeout(() => guardar(CLAVE_VISTA, { centro, zoom }), 600)
  }, [])

  const resaltados: Resaltado[] = useMemo(
    () =>
      seleccion?.tipo === 'recintos'
        ? seleccion.recintos.map((r, i) => ({
            geometria: r.geometria,
            activo: i === seleccion.activo,
          }))
        : [],
    [seleccion],
  )

  const quitarFiltros = () => setParametros(fincaParam ? { finca: fincaParam } : {}, { replace: true })

  return (
    <>
      <div className="fixed inset-x-0 top-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] isolate overflow-hidden bg-stone-200 lg:bottom-0 lg:left-72">
        <MapaLeaflet
          className="size-full"
          fincas={datos}
          fincaActiva={seleccion?.tipo === 'finca' ? seleccion.id : null}
          resaltados={resaltados}
          posicion={posicion}
          base={capas.base}
          verSigpac={capas.sigpac}
          verFincas={capas.fincas}
          ajuste={ajuste}
          vistaInicial={vistaGuardada}
          limitesIniciales={limitesIniciales}
          alElegirFinca={alElegirFinca}
          alTocar={alTocar}
          alMoverVista={alMoverVista}
        />

        {/* ---- Arriba: buscar parcela y capas ---- */}
        <div className="pt-seguro pointer-events-none absolute inset-x-0 top-0 z-[1000] space-y-2 p-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBuscando(true)}
              className="pointer-events-auto flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl bg-white px-4 text-left text-stone-600 shadow-lg ring-1 ring-stone-200 hover:bg-stone-50"
            >
              <Search className="size-5 shrink-0 text-stone-400" aria-hidden />
              <span className="truncate">Buscar parcela…</span>
            </button>
            <div className="pointer-events-auto flex items-center empty:hidden">
              <IndicadorSincronizacion />
            </div>
            <button
              type="button"
              onClick={() => setPanelCapas((a) => !a)}
              aria-expanded={panelCapas}
              aria-label="Capas del mapa"
              className={cx(
                'pointer-events-auto grid size-12 shrink-0 place-items-center rounded-xl shadow-lg ring-1 ring-stone-200',
                panelCapas ? 'bg-marca-700 text-white' : 'bg-white text-stone-700 hover:bg-stone-50',
              )}
            >
              <Layers className="size-6" aria-hidden />
            </button>
          </div>

          {panelCapas && (
            <div className="pointer-events-auto ml-auto w-72 max-w-full space-y-3 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-stone-200">
              <div>
                <p className="mb-2 text-sm font-semibold text-stone-700">Fondo</p>
                <Opciones
                  etiqueta="Fondo del mapa"
                  valor={capas.base}
                  onChange={(base) => cambiarCapas({ base })}
                  opciones={(Object.keys(NOMBRES_BASE) as BaseMapa[]).map((b) => ({ valor: b, texto: NOMBRES_BASE[b] }))}
                  className="flex-wrap"
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-stone-700">Mostrar</p>
                <div className="flex flex-wrap gap-2">
                  <Etiqueta marcada={capas.sigpac} onClick={() => cambiarCapas({ sigpac: !capas.sigpac })}>
                    Recintos SIGPAC
                  </Etiqueta>
                  <Etiqueta marcada={capas.fincas} onClick={() => cambiarCapas({ fincas: !capas.fincas })}>
                    Fincas
                  </Etiqueta>
                </div>
              </div>
              <p className="border-t border-stone-100 pt-3 text-sm text-stone-600">
                En el mapa: <strong>{datos.length}</strong> de {filtradas.length} {filtradas.length === 1 ? 'finca' : 'fincas'}.
                {datos.length < filtradas.length && (
                  <>
                    {' '}
                    {filtradas.length - datos.length === 1 ? 'Una no tiene' : `${filtradas.length - datos.length} no tienen`} ubicación
                    (falta un recinto SIGPAC o un punto GPS).
                  </>
                )}
              </p>
              <p className="text-xs leading-relaxed text-stone-500">
                Ortofoto y mapa base: © Instituto Geográfico Nacional (PNOA). Recintos: © FEGA, Ministerio de Agricultura (SIGPAC).
              </p>
            </div>
          )}

          {filtrando && !panelCapas && (
            <div className="pointer-events-auto flex w-fit max-w-full items-center gap-2 rounded-full bg-white py-1 pr-1 pl-4 text-sm shadow-lg ring-1 ring-stone-200">
              <span className="min-w-0 truncate text-stone-700">
                Filtro activo: <strong>{datos.length}</strong> de {fincas?.length ?? 0} fincas
              </span>
              <button
                type="button"
                onClick={quitarFiltros}
                className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-stone-100 px-3 font-semibold text-stone-800 hover:bg-stone-200"
              >
                <X className="size-4" aria-hidden />
                Quitar
              </button>
            </div>
          )}

          {!conexion && (
            <p
              className="pointer-events-auto w-fit max-w-full rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-900 shadow-lg"
              role="status"
            >
              Sin conexión: el fondo del mapa solo se ve donde ya lo habías mirado.
            </p>
          )}
        </div>

        {/* ---- Abajo: botones y tarjeta ---- */}
        <div className="pb-seguro pointer-events-none absolute inset-x-0 bottom-0 z-[1000] flex flex-col items-end gap-3 p-3">
          {aviso && (
            <p
              role="status"
              className="pointer-events-auto mx-auto w-fit max-w-full rounded-xl bg-stone-900/95 px-4 py-3 text-center text-sm text-white shadow-lg"
            >
              {aviso}
            </p>
          )}

          <div className="pointer-events-auto flex flex-col gap-2">
            <button
              type="button"
              onClick={() => mover({ delta: 1 })}
              className="hidden size-12 place-items-center rounded-xl bg-white text-stone-700 shadow-lg ring-1 ring-stone-200 hover:bg-stone-50 lg:grid"
              aria-label="Acercar"
            >
              <Plus className="size-6" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => mover({ delta: -1 })}
              className="hidden size-12 place-items-center rounded-xl bg-white text-stone-700 shadow-lg ring-1 ring-stone-200 hover:bg-stone-50 lg:grid"
              aria-label="Alejar"
            >
              <Minus className="size-6" aria-hidden />
            </button>
            <button
              type="button"
              onClick={pulsarMiPosicion}
              disabled={localizando}
              className="grid size-14 place-items-center rounded-2xl bg-marca-700 text-white shadow-lg hover:bg-marca-800 active:scale-95 disabled:opacity-80"
              aria-label="Mi posición"
            >
              {localizando ? <LoaderCircle className="size-7 animate-spin" aria-hidden /> : <LocateFixed className="size-7" aria-hidden />}
            </button>
          </div>

          {consultando && (
            <p
              role="status"
              className="pointer-events-auto mx-auto flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm text-stone-700 shadow-lg"
            >
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Consultando el SIGPAC…
            </p>
          )}

          {seleccion?.tipo === 'finca' && (
            <div className="pointer-events-none flex w-full justify-center">
              <TarjetaFinca id={seleccion.id} alCerrar={() => setSeleccion(null)} />
            </div>
          )}
          {seleccion?.tipo === 'recintos' && (
            <div className="pointer-events-none flex w-full justify-center">
              <TarjetaRecintos
                recintos={seleccion.recintos}
                activo={seleccion.activo}
                alElegir={(i) => {
                  setSeleccion({ ...seleccion, activo: i })
                  const limites = limitesDe([seleccion.recintos[i].geometria].filter((g) => g !== null))
                  if (limites) mover({ limites })
                }}
                alCerrar={() => setSeleccion(null)}
              />
            </div>
          )}

          {datos.length === 0 && listo && !seleccion && !consultando && !aviso && (
            <p className="pointer-events-auto mx-auto w-fit max-w-full rounded-xl bg-white/95 px-4 py-3 text-center text-sm text-stone-600 shadow-lg">
              {filtrando ? (
                'Ninguna finca con estos filtros tiene ubicación.'
              ) : (
                <>
                  Aún no hay fincas con ubicación. Añade un recinto SIGPAC o un punto GPS en la{' '}
                  <Link to="/fincas" className="font-semibold text-marca-800 underline">
                    ficha de la finca
                  </Link>
                  .
                </>
              )}
            </p>
          )}
        </div>
      </div>

      <DialogoBuscarReferencia
        abierto={buscando}
        alCerrar={() => setBuscando(false)}
        titulo="Buscar parcela"
        accion="Ver en el mapa"
        marcarTodos
        onElegir={(encontrados) => {
          mostrarRecintos(encontrados, true)
          return encontrados.length
        }}
      />
    </>
  )
}
