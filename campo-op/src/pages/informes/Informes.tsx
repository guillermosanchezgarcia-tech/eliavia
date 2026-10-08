import { ChartNoAxesColumn, ChevronRight, CloudOff, FileSpreadsheet } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { usePerfil } from '../../auth/contexto'
import { Cabecera, Contenido } from '../../components/Layout'
import { Aviso, Boton, Cargando, Etiqueta, Opciones, Seleccion, Tarjeta, Vacio } from '../../components/ui'
import { config } from '../../config'
import { useAjuste, useFincas, useSocios } from '../../datos/consultas'
import { CLAVE_ULTIMA_SINCRONIZACION } from '../../datos/sincronizacion'
import { useConexion } from '../../hooks/useConexion'
import { useExportarExcel } from '../../hooks/useExportarExcel'
import { hojasInforme, nombreDeArchivo } from '../../lib/exportar'
import { SIN_VALOR } from '../../lib/fincas'
import { formatearHa, formatearNumero, hoy } from '../../lib/formato'
import {
  DIMENSIONES_INFORME,
  fincasDelInforme,
  NOMBRES_DIMENSION,
  opcionesDeFiltro,
  resumenDe,
  totalesPor,
  type DimensionInforme,
  type FilaTotales,
  type FiltrosInforme,
} from '../../lib/informes'

const TEXTO_PESTANA: Record<DimensionInforme, string> = {
  cultivo: 'Cultivo',
  municipio: 'Municipio',
  certificacion: 'Certificación',
  tipo: 'Tipo',
}

const PLURAL = (n: number, uno: string, varios: string) => `${formatearNumero(n)} ${n === 1 ? uno : varios}`

export function Informes() {
  const perfil = usePerfil()
  const conexion = useConexion()
  const fincas = useFincas()
  const socios = useSocios()
  const ultimaSincronizacion = useAjuste<string>(CLAVE_ULTIMA_SINCRONIZACION)
  const { exportar, exportando, error: errorExcel, cerrarError } = useExportarExcel()

  // Los filtros viven en la dirección, como en las listas: se conservan al volver atrás.
  const [parametros, setParametros] = useSearchParams()
  const campana = parametros.get('campana') ?? ''
  const tipo = parametros.get('tipo') ?? ''
  const incluirBajas = parametros.get('bajas') === '1'
  const filtros = useMemo<FiltrosInforme>(() => ({ campana, tipo, incluirBajas }), [campana, tipo, incluirBajas])
  const ver = DIMENSIONES_INFORME.find((d) => d === parametros.get('ver')) ?? 'cultivo'

  function cambiar(clave: string, valor: string) {
    setParametros(
      (p) => {
        const nuevos = new URLSearchParams(p)
        if (valor) nuevos.set(clave, valor)
        else nuevos.delete(clave)
        return nuevos
      },
      { replace: true },
    )
  }

  const datos = useMemo(() => {
    if (!fincas || !socios) return null
    // Las opciones de los desplegables cuentan las fincas antes de aplicar la campaña y el tipo.
    const base = fincasDelInforme(fincas, socios, { campana: '', tipo: '', incluirBajas })
    const elegidas = fincasDelInforme(fincas, socios, filtros)
    return {
      elegidas,
      resumen: resumenDe(elegidas),
      campanas: opcionesDeFiltro(base, 'campana'),
      tipos: opcionesDeFiltro(base, 'tipo'),
      filas: Object.fromEntries(DIMENSIONES_INFORME.map((d) => [d, totalesPor(elegidas, d)])) as Record<DimensionInforme, FilaTotales[]>,
    }
  }, [fincas, socios, filtros, incluirBajas])

  const cargando = datos === null || ultimaSincronizacion === undefined
  const nuncaSincronizado = ultimaSincronizacion === null
  const hayFiltros = Boolean(filtros.campana || filtros.tipo || filtros.incluirBajas)

  /** A la lista de fincas con las mismas condiciones que este informe y la fila elegida. */
  function enlaceFila(dimension: DimensionInforme, clave: string): string {
    const p = new URLSearchParams()
    if (filtros.campana) p.set('campana', filtros.campana)
    if (filtros.tipo) p.set('tipo', filtros.tipo)
    if (!filtros.incluirBajas) p.set('activos', '1')
    p.set(dimension, clave)
    return `/fincas?${p.toString()}`
  }

  return (
    <>
      <Cabecera
        titulo="Informes"
        atras
        subtitulo={datos ? `${PLURAL(datos.resumen.fincas, 'finca', 'fincas')} · ${formatearHa(datos.resumen.ha)}` : undefined}
        acciones={
          datos && datos.elegidas.length > 0 ? (
            <Boton
              variante="fantasma"
              icono={FileSpreadsheet}
              cargando={exportando}
              onClick={() =>
                void exportar(nombreDeArchivo('informe', config.nombreOP, hoy()), () =>
                  hojasInforme({
                    fincas: datos.elegidas,
                    socios: socios ?? [],
                    filtros,
                    organizacion: config.nombreOP,
                    autor: perfil.nombre || perfil.email,
                    generado: new Date().toISOString(),
                  }),
                )
              }
            >
              <span className="sr-only sm:not-sr-only">Excel</span>
            </Boton>
          ) : undefined
        }
      />

      <Contenido className="space-y-5 pb-24">
        {errorExcel && (
          <Aviso tipo="error" titulo="No se ha podido exportar">
            {errorExcel}{' '}
            <button type="button" onClick={cerrarError} className="font-semibold underline">
              Cerrar
            </button>
          </Aviso>
        )}

        {cargando ? (
          <Cargando />
        ) : fincas === undefined || fincas.length === 0 ? (
          <Tarjeta>
            {nuncaSincronizado && !conexion ? (
              <Vacio icono={CloudOff} titulo="Falta la primera descarga">
                La primera vez que se usa la app en un dispositivo hace falta conexión para descargar los datos de la OP.
              </Vacio>
            ) : nuncaSincronizado ? (
              <Cargando texto="Descargando los datos de la OP…" />
            ) : (
              <Vacio icono={ChartNoAxesColumn} titulo="Todavía no hay datos para el informe">
                Cuando haya fincas dadas de alta, aquí verás los totales por cultivo, municipio y certificación.
              </Vacio>
            )}
          </Tarjeta>
        ) : (
          <>
            <Tarjeta className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-3">
                <Seleccion
                  etiqueta="Campaña"
                  value={filtros.campana}
                  onChange={(e) => cambiar('campana', e.target.value)}
                  vacia="Todas"
                  opciones={datos.campanas}
                />
                <Seleccion
                  etiqueta="Tipo de finca"
                  value={filtros.tipo}
                  onChange={(e) => cambiar('tipo', e.target.value)}
                  vacia="Todos"
                  opciones={datos.tipos}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Etiqueta marcada={filtros.incluirBajas} onClick={() => cambiar('bajas', filtros.incluirBajas ? '' : '1')}>
                  Incluir socios de baja
                </Etiqueta>
                {hayFiltros && (
                  <button
                    type="button"
                    onClick={() => setParametros(parametros.get('ver') ? { ver: parametros.get('ver')! } : {}, { replace: true })}
                    className="min-h-10 px-2 text-sm font-semibold text-marca-800 hover:underline"
                  >
                    Quitar filtros
                  </button>
                )}
              </div>
            </Tarjeta>

            <section aria-label="Resumen" className="grid grid-cols-3 gap-3">
              <Cifra valor={formatearNumero(datos.resumen.socios)} texto={datos.resumen.socios === 1 ? 'Socio' : 'Socios'} />
              <Cifra valor={formatearNumero(datos.resumen.fincas)} texto={datos.resumen.fincas === 1 ? 'Finca' : 'Fincas'} />
              <Cifra valor={formatearNumero(datos.resumen.ha, 2)} texto="Hectáreas" />
            </section>
            {datos.resumen.sinSuperficie > 0 && (
              <p className="-mt-2 px-1 text-sm text-stone-500">
                {PLURAL(datos.resumen.sinSuperficie, 'finca no tiene', 'fincas no tienen')} la superficie indicada y no suma
                hectáreas.
              </p>
            )}

            {datos.elegidas.length === 0 ? (
              <Tarjeta>
                <Vacio icono={ChartNoAxesColumn} titulo="Ninguna finca con estos filtros">
                  Prueba con otra campaña o quita los filtros.
                </Vacio>
              </Tarjeta>
            ) : (
              <section>
                <Opciones
                  etiqueta="Totales por"
                  valor={ver}
                  onChange={(v) => cambiar('ver', v === 'cultivo' ? '' : v)}
                  opciones={DIMENSIONES_INFORME.map((d) => ({ valor: d, texto: TEXTO_PESTANA[d] }))}
                />
                <h2 className="mt-4 mb-2 px-1 text-sm font-semibold tracking-wide text-stone-500 uppercase">
                  {NOMBRES_DIMENSION[ver]}
                </h2>
                <Tarjeta className="divide-y divide-stone-100 overflow-hidden">
                  {datos.filas[ver].map((fila) => (
                    <FilaInforme key={fila.clave} fila={fila} a={enlaceFila(ver, fila.clave)} />
                  ))}
                </Tarjeta>
                {ver === 'certificacion' && (
                  <p className="mt-3 px-1 text-sm text-stone-500">
                    Una finca con varias certificaciones cuenta en cada una de ellas, por eso las filas no suman el total.
                  </p>
                )}
                <p className="mt-3 px-1 text-sm text-stone-500">Pulsa una fila para ver sus fincas.</p>
              </section>
            )}
          </>
        )}
      </Contenido>
    </>
  )
}

function Cifra({ valor, texto }: { valor: string; texto: string }) {
  return (
    <Tarjeta className="px-3 py-4 text-center">
      <p className="text-2xl font-bold text-marca-800 tabular-nums">{valor}</p>
      <p className="mt-0.5 text-xs font-medium text-stone-500">{texto}</p>
    </Tarjeta>
  )
}

function FilaInforme({ fila, a }: { fila: FilaTotales; a: string }) {
  const sinDato = fila.clave === SIN_VALOR
  const porcentaje = Math.round(fila.parte * 1000) / 10
  return (
    <Link to={a} className="block px-4 py-3 transition hover:bg-stone-50 active:bg-stone-100">
      <span className="flex items-baseline justify-between gap-3">
        <span className={`min-w-0 truncate font-semibold ${sinDato ? 'text-stone-500' : 'text-stone-900'}`}>{fila.etiqueta}</span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="font-bold text-stone-900 tabular-nums">{formatearHa(fila.ha)}</span>
          <ChevronRight className="size-4 text-stone-400" aria-hidden />
        </span>
      </span>
      <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-stone-100" aria-hidden>
        <span
          className={`block h-full rounded-full ${sinDato ? 'bg-stone-300' : 'bg-marca-600'}`}
          style={{ width: `${fila.ha > 0 ? Math.max(2, fila.parte * 100) : 0}%` }}
        />
      </span>
      <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-stone-500">
        <span>{PLURAL(fila.fincas, 'finca', 'fincas')}</span>
        <span>{PLURAL(fila.socios, 'socio', 'socios')}</span>
        {fila.ha > 0 && <span>{formatearNumero(porcentaje, 1)} % de la superficie</span>}
        {fila.sinSuperficie > 0 && <span>{PLURAL(fila.sinSuperficie, 'sin superficie', 'sin superficie')}</span>}
      </span>
    </Link>
  )
}
