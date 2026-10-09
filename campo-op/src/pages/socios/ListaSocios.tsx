import { ArrowDownUp, CloudOff, FileSpreadsheet, Search, SearchX, UserPlus, Users, X } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { usePerfil } from '../../auth/contexto'
import { Cabecera, Contenido } from '../../components/Layout'
import { Aviso, Boton, BotonFlotante, Cargando, EnlaceBoton, Insignia, Opciones, Tarjeta, Vacio } from '../../components/ui'
import { config } from '../../config'
import { useAjuste, useFincas, useSocios } from '../../datos/consultas'
import { CLAVE_ULTIMA_SINCRONIZACION } from '../../datos/sincronizacion'
import { useCargaProgresiva } from '../../hooks/useCargaProgresiva'
import { useConexion } from '../../hooks/useConexion'
import { useExportarExcel } from '../../hooks/useExportarExcel'
import { cx } from '../../lib/cx'
import { hojaSocios, nombreDeArchivo } from '../../lib/exportar'
import { coincide, comparar, formatearHa, hoy, iniciales } from '../../lib/formato'
import type { Socio } from '../../lib/tipos'

type FiltroEstado = 'activo' | 'baja' | 'todos'
type Orden = 'nombre' | 'codigo'

export function ListaSocios() {
  const perfil = usePerfil()
  const conexion = useConexion()
  const socios = useSocios()
  const fincas = useFincas()
  const ultimaSincronizacion = useAjuste<string>(CLAVE_ULTIMA_SINCRONIZACION)
  const { exportar, exportando, error: errorExcel, cerrarError } = useExportarExcel()

  // La búsqueda se guarda en la dirección para que se conserve al volver atrás.
  const [parametros, setParametros] = useSearchParams()
  const busqueda = parametros.get('q') ?? ''
  const estado = (parametros.get('estado') as FiltroEstado | null) ?? 'activo'
  const orden = (parametros.get('orden') as Orden | null) ?? 'nombre'

  function cambiar(clave: string, valor: string, porDefecto: string) {
    setParametros(
      (p) => {
        const nuevos = new URLSearchParams(p)
        if (valor === porDefecto) nuevos.delete(clave)
        else nuevos.set(clave, valor)
        return nuevos
      },
      { replace: true },
    )
  }

  const resumenFincas = useMemo(() => {
    const mapa = new Map<string, { n: number; ha: number }>()
    for (const f of fincas ?? []) {
      const r = mapa.get(f.socio_id) ?? { n: 0, ha: 0 }
      r.n += 1
      r.ha += f.superficie_ha ?? 0
      mapa.set(f.socio_id, r)
    }
    return mapa
  }, [fincas])

  const cuentas = useMemo(() => {
    const lista = socios ?? []
    const activos = lista.filter((s) => s.estado === 'activo').length
    return { activo: activos, baja: lista.length - activos, todos: lista.length }
  }, [socios])

  const resultado = useMemo(() => {
    const lista = (socios ?? []).filter(
      (s) =>
        (estado === 'todos' || s.estado === estado) &&
        (!busqueda ||
          coincide(
            [s.codigo, s.nombre, s.nif, s.nif?.replace(/\W/g, ''), s.localidad, s.telefono].filter(Boolean).join(' '),
            busqueda,
          )),
    )
    return lista.sort((a, b) =>
      orden === 'codigo' ? comparar(a.codigo, b.codigo) : comparar(a.nombre, b.nombre) || comparar(a.codigo, b.codigo),
    )
  }, [socios, estado, busqueda, orden])

  const { visibles, centinela } = useCargaProgresiva(`${busqueda}|${estado}|${orden}`)

  const esAdmin = perfil.rol === 'admin'
  const cargando = socios === undefined || ultimaSincronizacion === undefined
  const nuncaSincronizado = ultimaSincronizacion === null

  return (
    <>
      <Cabecera
        titulo="Socios"
        subtitulo={socios ? `${cuentas.activo} activos · ${cuentas.baja} de baja` : undefined}
        acciones={
          // La lista con NIF, teléfonos y correos solo la puede sacar a un archivo la administración.
          esAdmin && socios && socios.length > 0 ? (
            <Boton
              variante="fantasma"
              icono={FileSpreadsheet}
              cargando={exportando}
              onClick={() =>
                void exportar(nombreDeArchivo('socios', config.nombreOP, hoy()), () => [hojaSocios(resultado, fincas ?? [])])
              }
            >
              <span className="sr-only sm:not-sr-only">Excel</span>
            </Boton>
          ) : undefined
        }
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-stone-400" aria-hidden />
            <input
              type="search"
              enterKeyHint="search"
              value={busqueda}
              onChange={(e) => cambiar('q', e.target.value, '')}
              placeholder="Nombre, código, NIF, localidad…"
              aria-label="Buscar socio"
              className="block min-h-12 w-full rounded-xl border border-stone-300 bg-white pr-11 pl-11 text-stone-900 placeholder:text-stone-400 focus:border-marca-600 focus:ring-2 focus:ring-marca-600/20 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => cambiar('q', '', '')}
                className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-stone-500 hover:text-stone-800"
                aria-label="Borrar búsqueda"
              >
                <X className="size-5" aria-hidden />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Opciones
              etiqueta="Estado del socio"
              className="flex-1"
              valor={estado}
              onChange={(v) => cambiar('estado', v, 'activo')}
              opciones={[
                { valor: 'activo', texto: 'Activos', cuenta: cuentas.activo },
                { valor: 'baja', texto: 'De baja', cuenta: cuentas.baja },
                { valor: 'todos', texto: 'Todos', cuenta: cuentas.todos },
              ]}
            />
            <button
              type="button"
              onClick={() => cambiar('orden', orden === 'nombre' ? 'codigo' : 'nombre', 'nombre')}
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-stone-600 hover:bg-stone-200/60"
              aria-label={`Ordenado por ${orden === 'nombre' ? 'nombre' : 'código'}. Pulsa para cambiar.`}
            >
              <ArrowDownUp className="size-4" aria-hidden />
              {orden === 'nombre' ? 'Nombre' : 'Código'}
            </button>
          </div>
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
        ) : socios.length === 0 ? (
          <Tarjeta>
            {nuncaSincronizado && !conexion ? (
              <Vacio icono={CloudOff} titulo="Falta la primera descarga">
                La primera vez que se usa la app en un dispositivo hace falta conexión para descargar los datos de la OP.
              </Vacio>
            ) : nuncaSincronizado ? (
              <Cargando texto="Descargando los datos de la OP…" />
            ) : (
              <Vacio
                icono={Users}
                titulo="Todavía no hay socios"
                accion={
                  esAdmin && (
                    <EnlaceBoton a="/socios/nuevo" icono={UserPlus}>
                      Dar de alta el primero
                    </EnlaceBoton>
                  )
                }
              >
                {esAdmin
                  ? 'Empieza dando de alta a los socios de la OP.'
                  : 'Cuando el administrador dé de alta a los socios, aparecerán aquí.'}
              </Vacio>
            )}
          </Tarjeta>
        ) : resultado.length === 0 ? (
          <Tarjeta>
            <Vacio icono={SearchX} titulo="Ningún socio coincide">
              {busqueda ? (
                <>
                  No hay socios {estado === 'activo' ? 'activos ' : estado === 'baja' ? 'de baja ' : ''}que coincidan con
                  «{busqueda}».
                </>
              ) : (
                'No hay socios en este grupo.'
              )}
              {estado !== 'todos' && (
                <button
                  type="button"
                  onClick={() => cambiar('estado', 'todos', 'activo')}
                  className="mt-3 block w-full font-semibold text-marca-800 hover:underline"
                >
                  Buscar en todos los socios
                </button>
              )}
            </Vacio>
          </Tarjeta>
        ) : (
          <>
            {busqueda && (
              <p className="mb-3 px-1 text-sm text-stone-500" aria-live="polite">
                {resultado.length === 1 ? '1 socio encontrado' : `${resultado.length} socios encontrados`}
              </p>
            )}
            <Tarjeta className="divide-y divide-stone-100 overflow-hidden">
              {resultado.slice(0, visibles).map((s) => (
                <FilaSocio key={s.id} socio={s} fincas={resumenFincas.get(s.id)} />
              ))}
            </Tarjeta>
            {visibles < resultado.length && <div key={visibles} ref={centinela} className="h-10" aria-hidden />}
          </>
        )}
      </Contenido>

      {esAdmin && <BotonFlotante a="/socios/nuevo" icono={UserPlus} texto="Nuevo socio" />}
    </>
  )
}

function FilaSocio({ socio, fincas }: { socio: Socio; fincas?: { n: number; ha: number } }) {
  const baja = socio.estado === 'baja'
  return (
    <Link
      to={`/socios/${socio.id}`}
      className="flex min-h-18 items-center gap-3 px-4 py-3 transition hover:bg-stone-50 active:bg-stone-100"
    >
      <span
        className={cx(
          'grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold',
          baja ? 'bg-stone-100 text-stone-500' : 'bg-marca-100 text-marca-800',
        )}
        aria-hidden
      >
        {iniciales(socio.nombre) || '?'}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate font-semibold', baja ? 'text-stone-500' : 'text-stone-900')}>
          {socio.nombre}
        </span>
        <span className="block truncate text-sm text-stone-500">
          Cód. {socio.codigo}
          {socio.localidad && ` · ${socio.localidad}`}
        </span>
      </span>
      <span className="shrink-0 text-right">
        {baja ? (
          <Insignia color="gris">Baja</Insignia>
        ) : (
          <>
            <span className="block text-sm font-semibold text-stone-800 tabular-nums">
              {fincas ? formatearHa(fincas.ha) : '—'}
            </span>
            <span className="block text-xs text-stone-500">
              {fincas ? (fincas.n === 1 ? '1 finca' : `${fincas.n} fincas`) : 'sin fincas'}
            </span>
          </>
        )}
      </span>
    </Link>
  )
}
