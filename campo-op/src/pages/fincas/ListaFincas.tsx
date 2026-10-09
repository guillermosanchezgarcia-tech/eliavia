import { CloudOff, FileSpreadsheet, Map as MapIcon, Plus, Search, SearchX, SlidersHorizontal, Sprout, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Cabecera, Contenido } from '../../components/Layout'
import { Aviso, BotonFlotante, Boton, Cargando, Dialogo, EnlaceBoton, Etiqueta, Insignia, Seleccion, Tarjeta, Vacio } from '../../components/ui'
import { useAjuste, useFincas, useRecintos, useSocios } from '../../datos/consultas'
import { CLAVE_ULTIMA_SINCRONIZACION } from '../../datos/sincronizacion'
import { config } from '../../config'
import { useCargaProgresiva } from '../../hooks/useCargaProgresiva'
import { useConexion } from '../../hooks/useConexion'
import { useCriteriosFincas } from '../../hooks/useCriteriosFincas'
import { useExportarExcel } from '../../hooks/useExportarExcel'
import { NOMBRES_TIPO_FINCA } from '../../lib/catalogos'
import { cx } from '../../lib/cx'
import { hojaFincas, nombreDeArchivo } from '../../lib/exportar'
import { construirTextos, descripcionTipo, filtrarFincas, SIN_VALOR, type OrdenFincas } from '../../lib/fincas'
import { formatearHa, formatearNumero, hoy } from '../../lib/formato'
import { etiquetaMunicipio, opcionesDeFiltro, TEXTO_SIN_DATO } from '../../lib/informes'
import { nombreMunicipio } from '../../lib/sigpac'
import type { Finca } from '../../lib/tipos'

const FILTROS = ['socio', 'tipo', 'cultivo', 'municipio', 'certificacion', 'campana'] as const
type Filtro = (typeof FILTROS)[number]

const NOMBRES_ORDEN: Record<OrdenFincas, string> = {
  nombre: 'Nombre de la finca',
  socio: 'Nombre del socio',
  superficie: 'Superficie (mayor primero)',
}

export function ListaFincas() {
  const conexion = useConexion()
  const fincas = useFincas()
  const socios = useSocios()
  const recintos = useRecintos()
  const ultimaSincronizacion = useAjuste<string>(CLAVE_ULTIMA_SINCRONIZACION)
  const [panelAbierto, setPanelAbierto] = useState(false)

  // Búsqueda y filtros viven en la dirección: al volver atrás se conservan y se pueden compartir.
  const [parametros, setParametros] = useSearchParams()
  const criterios = useCriteriosFincas()
  const { busqueda, orden } = criterios
  const valor = (f: Filtro) => criterios[f]

  function cambiar(clave: string, nuevo: string, porDefecto = '') {
    setParametros(
      (p) => {
        const nuevos = new URLSearchParams(p)
        if (nuevo === porDefecto) nuevos.delete(clave)
        else nuevos.set(clave, nuevo)
        return nuevos
      },
      { replace: true },
    )
  }

  const sociosPorId = useMemo(() => new Map((socios ?? []).map((s) => [s.id, s])), [socios])

  const textos = useMemo(() => construirTextos(fincas ?? [], recintos ?? [], socios ?? []), [fincas, recintos, socios])

  // Valores disponibles para cada filtro, con cuántas fincas tiene cada uno.
  const opciones = useMemo(
    () => ({
      cultivos: opcionesDeFiltro(fincas ?? [], 'cultivo'),
      municipios: opcionesDeFiltro(fincas ?? [], 'municipio'),
      certificaciones: opcionesDeFiltro(fincas ?? [], 'certificacion'),
      campanas: opcionesDeFiltro(fincas ?? [], 'campana'),
    }),
    [fincas],
  )

  // Filtrar y ordenar unos miles de fincas es instantáneo: no hace falta guardar el resultado.
  const resultado = filtrarFincas(fincas ?? [], textos, sociosPorId, criterios)

  const totalHa = resultado.reduce((s, f) => s + (f.superficie_ha ?? 0), 0)
  const activos = [...FILTROS.filter((f) => valor(f)), ...(criterios.soloActivos ? (['activos'] as const) : [])]
  const { visibles, centinela } = useCargaProgresiva(`${busqueda}|${orden}|${parametros.toString()}`)
  const { exportar, exportando, error: errorExcel, cerrarError } = useExportarExcel()

  const cargando = fincas === undefined || socios === undefined || ultimaSincronizacion === undefined
  const nuncaSincronizado = ultimaSincronizacion === null

  function etiquetaFiltro(f: Filtro | 'activos'): string {
    if (f === 'activos') return 'Solo socios activos'
    const v = valor(f)
    if (f !== 'socio' && v === SIN_VALOR) return TEXTO_SIN_DATO[f]
    if (f === 'socio') return sociosPorId.get(v)?.nombre ?? 'Socio'
    if (f === 'tipo') return NOMBRES_TIPO_FINCA[v as keyof typeof NOMBRES_TIPO_FINCA] ?? v
    if (f === 'municipio') {
      const [p, m] = v.split(':').map(Number)
      return etiquetaMunicipio(p, m)
    }
    return f === 'campana' ? `Campaña ${v}` : v
  }

  return (
    <>
      <Cabecera
        titulo="Fincas"
        subtitulo={fincas ? `${formatearNumero(resultado.length)} ${resultado.length === 1 ? 'finca' : 'fincas'} · ${formatearHa(totalHa)}` : undefined}
        acciones={
          <>
            {fincas && fincas.length > 0 && (
              <Boton
                variante="fantasma"
                icono={FileSpreadsheet}
                cargando={exportando}
                onClick={() =>
                  void exportar(nombreDeArchivo('fincas', config.nombreOP, hoy()), () => [hojaFincas(resultado, socios ?? [])])
                }
              >
                <span className="sr-only sm:not-sr-only">Excel</span>
              </Boton>
            )}
            <EnlaceBoton a={`/mapa${parametros.toString() ? `?${parametros.toString()}` : ''}`} variante="fantasma" icono={MapIcon}>
              <span className="sr-only sm:not-sr-only">Mapa</span>
            </EnlaceBoton>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-stone-400" aria-hidden />
              <input
                type="search"
                enterKeyHint="search"
                value={busqueda}
                onChange={(e) => cambiar('q', e.target.value)}
                placeholder="Finca, socio, cultivo, polígono…"
                aria-label="Buscar finca"
                className="block min-h-12 w-full rounded-xl border border-stone-300 bg-white pr-11 pl-11 text-stone-900 placeholder:text-stone-400 focus:border-marca-600 focus:ring-2 focus:ring-marca-600/20 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => cambiar('q', '')}
                  className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-stone-500 hover:text-stone-800"
                  aria-label="Borrar búsqueda"
                >
                  <X className="size-5" aria-hidden />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPanelAbierto(true)}
              className={cx(
                'relative inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl px-3.5 font-medium ring-1 transition',
                activos.length ? 'bg-marca-700 text-white ring-marca-700' : 'bg-white text-stone-700 ring-stone-300 hover:bg-stone-50',
              )}
              aria-label={activos.length ? `Filtros (${activos.length} activos)` : 'Filtros'}
            >
              <SlidersHorizontal className="size-5" aria-hidden />
              <span className="hidden sm:inline">Filtros</span>
              {activos.length > 0 && <span className="tabular-nums">{activos.length}</span>}
            </button>
          </div>
          {activos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {activos.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => cambiar(f, '')}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-marca-100 pr-2 pl-3.5 text-sm font-medium text-marca-900"
                  aria-label={`Quitar el filtro ${etiquetaFiltro(f)}`}
                >
                  {etiquetaFiltro(f)}
                  <X className="size-4" aria-hidden />
                </button>
              ))}
            </div>
          )}
        </div>
      </Cabecera>

      <Contenido className="pb-24">
        {errorExcel && (
          <div className="mb-3">
            <Aviso tipo="error" titulo="No se ha podido exportar">
              {errorExcel}{' '}
              <button type="button" onClick={cerrarError} className="font-semibold underline">
                Cerrar
              </button>
            </Aviso>
          </div>
        )}
        {cargando ? (
          <Cargando />
        ) : fincas.length === 0 ? (
          <Tarjeta>
            {nuncaSincronizado && !conexion ? (
              <Vacio icono={CloudOff} titulo="Falta la primera descarga">
                La primera vez que se usa la app en un dispositivo hace falta conexión para descargar los datos de la OP.
              </Vacio>
            ) : nuncaSincronizado ? (
              <Cargando texto="Descargando los datos de la OP…" />
            ) : (
              <Vacio
                icono={Sprout}
                titulo="Todavía no hay fincas"
                accion={
                  <EnlaceBoton a="/fincas/nueva" icono={Plus}>
                    Añadir la primera
                  </EnlaceBoton>
                }
              >
                Cada finca pertenece a un socio. Añádelas aquí o desde la ficha del socio.
              </Vacio>
            )}
          </Tarjeta>
        ) : resultado.length === 0 ? (
          <Tarjeta>
            <Vacio icono={SearchX} titulo="Ninguna finca coincide">
              {busqueda ? `No hay fincas que coincidan con «${busqueda}»` : 'No hay fincas con estos filtros'}
              {activos.length > 0 && ' y los filtros elegidos'}.
              {(activos.length > 0 || busqueda) && (
                <button
                  type="button"
                  onClick={() => setParametros({}, { replace: true })}
                  className="mt-3 block w-full font-semibold text-marca-800 hover:underline"
                >
                  Quitar búsqueda y filtros
                </button>
              )}
            </Vacio>
          </Tarjeta>
        ) : (
          <>
            <Tarjeta className="divide-y divide-stone-100 overflow-hidden">
              {resultado.slice(0, visibles).map((f) => (
                <FilaFinca key={f.id} finca={f} socio={sociosPorId.get(f.socio_id)?.nombre} />
              ))}
            </Tarjeta>
            {visibles < resultado.length && <div key={visibles} ref={centinela} className="h-10" aria-hidden />}
          </>
        )}
      </Contenido>

      <BotonFlotante a={valor('socio') ? `/fincas/nueva?socio=${valor('socio')}` : '/fincas/nueva'} icono={Plus} texto="Nueva finca" />

      <Dialogo
        abierto={panelAbierto}
        titulo="Filtros"
        alCerrar={() => setPanelAbierto(false)}
        acciones={
          <>
            <Boton
              variante="secundario"
              disabled={!activos.length && orden === 'nombre'}
              onClick={() => setParametros(busqueda ? { q: busqueda } : {}, { replace: true })}
            >
              Quitar filtros
            </Boton>
            <Boton onClick={() => setPanelAbierto(false)}>
              Ver {formatearNumero(resultado.length)} {resultado.length === 1 ? 'finca' : 'fincas'}
            </Boton>
          </>
        }
      >
        <div className="space-y-3 text-stone-900">
          <Seleccion
            etiqueta="Tipo de finca"
            value={valor('tipo')}
            onChange={(e) => cambiar('tipo', e.target.value)}
            vacia="Todos"
            opciones={Object.entries(NOMBRES_TIPO_FINCA).map(([v, t]) => ({ valor: v, texto: t }))}
          />
          <Seleccion
            etiqueta="Cultivo"
            value={valor('cultivo')}
            onChange={(e) => cambiar('cultivo', e.target.value)}
            vacia="Todos"
            opciones={opciones.cultivos.map((o) => ({ valor: o.valor, texto: o.texto }))}
          />
          <Seleccion
            etiqueta="Municipio"
            value={valor('municipio')}
            onChange={(e) => cambiar('municipio', e.target.value)}
            vacia="Todos"
            opciones={opciones.municipios}
          />
          <Seleccion
            etiqueta="Certificación"
            value={valor('certificacion')}
            onChange={(e) => cambiar('certificacion', e.target.value)}
            vacia="Todas"
            opciones={opciones.certificaciones}
          />
          <Seleccion
            etiqueta="Campaña"
            value={valor('campana')}
            onChange={(e) => cambiar('campana', e.target.value)}
            vacia="Todas"
            opciones={opciones.campanas}
          />
          <Etiqueta marcada={criterios.soloActivos} onClick={() => cambiar('activos', criterios.soloActivos ? '' : '1')}>
            Solo fincas de socios activos
          </Etiqueta>
          {valor('socio') && (
            <p className="flex items-center justify-between gap-2 rounded-xl bg-marca-50 px-3 py-2 text-sm text-marca-900">
              <span className="min-w-0 truncate">Socio: {etiquetaFiltro('socio')}</span>
              <button type="button" onClick={() => cambiar('socio', '')} className="shrink-0 font-semibold hover:underline">
                Quitar
              </button>
            </p>
          )}
          <Seleccion
            etiqueta="Ordenar por"
            value={orden}
            onChange={(e) => cambiar('orden', e.target.value, 'nombre')}
            opciones={Object.entries(NOMBRES_ORDEN).map(([v, t]) => ({ valor: v, texto: t }))}
          />
        </div>
      </Dialogo>
    </>
  )
}

function FilaFinca({ finca, socio }: { finca: Finca; socio?: string }) {
  const municipio = nombreMunicipio(finca.provincia, finca.municipio)
  const tipo = descripcionTipo(finca)
  return (
    <Link to={`/fincas/${finca.id}`} className="flex min-h-18 items-center gap-3 px-4 py-3 transition hover:bg-stone-50 active:bg-stone-100">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-marca-50 text-marca-700" aria-hidden>
        <Sprout className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-stone-900">{finca.nombre}</span>
        <span className="block truncate text-sm text-stone-500">{[socio, municipio].filter(Boolean).join(' · ') || 'Sin socio'}</span>
        <span className="mt-0.5 flex flex-wrap gap-1.5">
          {finca.cultivo && <Insignia color="marca">{finca.cultivo}</Insignia>}
          {tipo && <Insignia>{finca.tipo === 'invernadero' ? 'Invernadero' : 'Aire libre'}</Insignia>}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-semibold text-stone-800 tabular-nums">{formatearHa(finca.superficie_ha)}</span>
        {finca.campana && <span className="block text-xs text-stone-500">{finca.campana}</span>}
      </span>
    </Link>
  )
}
