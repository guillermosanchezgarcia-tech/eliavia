import { useLiveQuery } from 'dexie-react-hooks'
import { CircleCheck, CloudOff, CloudUpload, RefreshCw, RotateCcw, TriangleAlert, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Cabecera, Contenido } from '../../components/Layout'
import { Aviso, Boton, Cargando, Dialogo, Tarjeta } from '../../components/ui'
import { useAjuste, usePendientes } from '../../datos/consultas'
import { db, type Pendiente, type Tabla } from '../../datos/db'
import { descartarCambios, reintentar } from '../../datos/pendientes'
import { CLAVE_ULTIMA_SINCRONIZACION, sincronizar, useEstadoSincronizacion } from '../../datos/sincronizacion'
import { useConexion } from '../../hooks/useConexion'
import { formatearFechaHora, formatearNumero, haceCuanto } from '../../lib/formato'

const NOMBRE_TABLA: Record<Tabla, string> = {
  socios: 'Socio',
  fincas: 'Finca',
  recintos: 'Recinto SIGPAC',
  fotos: 'Foto',
}

export function Sincronizacion() {
  const conexion = useConexion()
  const { sincronizando, error } = useEstadoSincronizacion()
  const pendientes = usePendientes()
  const ultima = useAjuste<string>(CLAVE_ULTIMA_SINCRONIZACION)
  const cuentas = useLiveQuery(async () => ({ socios: await db.socios.count(), fincas: await db.fincas.count() }), [])

  if (pendientes === undefined || ultima === undefined) {
    return (
      <>
        <Cabecera titulo="Sincronización" atras="/mas" />
        <Cargando />
      </>
    )
  }

  const conError = pendientes.filter((p) => p.error)
  const sinError = pendientes.filter((p) => !p.error)

  let resumen: { icono: typeof CircleCheck; titulo: string; texto: string; color: string }
  if (!conexion) {
    resumen = {
      icono: CloudOff,
      titulo: 'Sin conexión',
      texto: pendientes.length
        ? 'Los cambios están guardados en el móvil y se enviarán solos al volver la cobertura.'
        : 'Puedes seguir trabajando; los cambios se guardan en el móvil.',
      color: 'bg-amber-100 text-amber-800',
    }
  } else if (conError.length) {
    resumen = {
      icono: TriangleAlert,
      titulo: 'Hay cambios rechazados',
      texto: 'El servidor no ha aceptado algunos cambios. Revísalos abajo.',
      color: 'bg-red-100 text-red-700',
    }
  } else if (sinError.length) {
    resumen = {
      icono: CloudUpload,
      titulo: `${sinError.length} ${sinError.length === 1 ? 'cambio' : 'cambios'} por enviar`,
      texto: 'Se enviarán en unos segundos.',
      color: 'bg-amber-100 text-amber-800',
    }
  } else {
    resumen = {
      icono: CircleCheck,
      titulo: 'Todo al día',
      texto: 'No hay cambios pendientes de enviar.',
      color: 'bg-marca-100 text-marca-800',
    }
  }
  const IconoResumen = resumen.icono

  return (
    <>
      <Cabecera titulo="Sincronización" atras="/mas" />
      <Contenido className="space-y-5">
        <Tarjeta className="p-4">
          <div className="flex items-start gap-3">
            <span className={`grid size-11 shrink-0 place-items-center rounded-full ${resumen.color}`}>
              <IconoResumen className="size-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-stone-900">{resumen.titulo}</p>
              <p className="text-sm text-stone-600">{resumen.texto}</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-stone-50 p-3">
              <dt className="text-stone-500">Última sincronización</dt>
              <dd className="font-medium text-stone-900" title={formatearFechaHora(ultima)}>
                {haceCuanto(ultima)}
              </dd>
            </div>
            <div className="rounded-xl bg-stone-50 p-3">
              <dt className="text-stone-500">Datos en este móvil</dt>
              <dd className="font-medium text-stone-900">
                {cuentas
                  ? `${formatearNumero(cuentas.socios)} socios · ${formatearNumero(cuentas.fincas)} fincas`
                  : '…'}
              </dd>
            </div>
          </dl>
          <Boton
            className="mt-4"
            variante="secundario"
            icono={RefreshCw}
            bloque
            cargando={sincronizando}
            disabled={!conexion}
            onClick={() => void sincronizar()}
          >
            {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
          </Boton>
        </Tarjeta>

        {error && (
          <Aviso tipo="error" titulo="No se ha podido sincronizar">
            {error}
          </Aviso>
        )}

        {conError.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-sm font-semibold tracking-wide text-stone-500 uppercase">
              Cambios rechazados
            </h2>
            <ul className="space-y-3">
              {conError.map((p) => (
                <li key={p.num}>
                  <CambioRechazado pendiente={p} conexion={conexion} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {sinError.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-sm font-semibold tracking-wide text-stone-500 uppercase">
              Pendientes de enviar
            </h2>
            <Tarjeta className="divide-y divide-stone-100">
              {sinError.map((p) => (
                <div key={p.num} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <CloudUpload className="size-5 shrink-0 text-amber-600" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <DescripcionCambio pendiente={p} />
                  </span>
                  <span className="shrink-0 text-stone-500">{haceCuanto(p.creado)}</span>
                </div>
              ))}
            </Tarjeta>
          </section>
        )}
      </Contenido>
    </>
  )
}

function DescripcionCambio({ pendiente: p }: { pendiente: Pendiente }) {
  const nombre = useLiveQuery(async () => {
    const fila = (await db.table(p.tabla).get(p.fila_id)) as { nombre?: string; codigo?: string } | undefined
    const datos = { ...(fila ?? {}), ...p.cambios } as { nombre?: string; codigo?: string }
    return datos.nombre || datos.codigo || ''
  }, [p.tabla, p.fila_id, p.cambios])
  const que = p.cambios.eliminado ? 'eliminación' : p.operacion === 'crear' ? 'alta' : 'cambios'
  return (
    <>
      <span className="font-medium text-stone-900">
        {NOMBRE_TABLA[p.tabla]}
        {nombre ? ` · ${nombre}` : ''}
      </span>
      <span className="block text-stone-500">{que.charAt(0).toUpperCase() + que.slice(1)}</span>
    </>
  )
}

function CambioRechazado({ pendiente, conexion }: { pendiente: Pendiente; conexion: boolean }) {
  const [confirmar, setConfirmar] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function descartar() {
    setTrabajando(true)
    const fallo = await descartarCambios(pendiente)
    setTrabajando(false)
    setConfirmar(false)
    setError(fallo)
  }

  return (
    <Tarjeta className="p-4">
      <div className="flex gap-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
        <div className="min-w-0 flex-1 text-sm">
          <DescripcionCambio pendiente={pendiente} />
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-red-800">{pendiente.error}</p>
          {error && <p className="mt-2 text-red-700">{error}</p>}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Boton variante="secundario" icono={RotateCcw} disabled={!conexion} onClick={() => void reintentar(pendiente)}>
          Reintentar
        </Boton>
        <Boton variante="peligro" icono={Undo2} disabled={!conexion} onClick={() => setConfirmar(true)}>
          Descartar
        </Boton>
      </div>
      <Dialogo
        abierto={confirmar}
        titulo="¿Descartar este cambio?"
        alCerrar={() => setConfirmar(false)}
        acciones={
          <>
            <Boton variante="secundario" onClick={() => setConfirmar(false)}>
              Cancelar
            </Boton>
            <Boton variante="eliminar" cargando={trabajando} onClick={() => void descartar()}>
              Descartar
            </Boton>
          </>
        }
      >
        Se perderá lo que cambiaste en este registro y se recuperará la versión que hay en el servidor.
      </Dialogo>
    </Tarjeta>
  )
}
