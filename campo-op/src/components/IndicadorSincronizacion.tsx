import { CloudAlert, CloudOff, CloudUpload, RefreshCw } from 'lucide-react'
import { Link } from 'react-router'
import { usePendientes } from '../datos/consultas'
import { useEstadoSincronizacion } from '../datos/sincronizacion'
import { useConexion } from '../hooks/useConexion'
import { cx } from '../lib/cx'

/**
 * Pastilla de la cabecera que dice cómo va la sincronización. Si todo está
 * enviado y hay conexión, no se muestra nada. Al pulsarla lleva al detalle.
 */
export function IndicadorSincronizacion() {
  const conexion = useConexion()
  const { sincronizando, error } = useEstadoSincronizacion()
  const pendientes = usePendientes() ?? []
  const conError = pendientes.filter((p) => p.error).length
  const sinEnviar = pendientes.length

  let contenido: { icono: typeof CloudOff; texto: string; estilo: string; girar?: boolean } | null = null
  if (!conexion) {
    contenido = {
      icono: CloudOff,
      texto: sinEnviar ? `Sin conexión · ${sinEnviar}` : 'Sin conexión',
      estilo: 'bg-amber-100 text-amber-900',
    }
  } else if (conError || error) {
    contenido = { icono: CloudAlert, texto: conError ? `${conError} con error` : 'Error', estilo: 'bg-red-100 text-red-800' }
  } else if (sincronizando) {
    contenido = { icono: RefreshCw, texto: 'Sincronizando', estilo: 'bg-stone-100 text-stone-700', girar: true }
  } else if (sinEnviar) {
    contenido = { icono: CloudUpload, texto: `${sinEnviar} sin enviar`, estilo: 'bg-amber-100 text-amber-900' }
  }

  if (!contenido) return null
  const Icono = contenido.icono
  return (
    <Link
      to="/mas/sincronizacion"
      aria-label={`Sincronización: ${contenido.texto}`}
      className={cx(
        'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold',
        contenido.estilo,
      )}
    >
      <Icono className={cx('size-4', contenido.girar && 'animate-spin')} aria-hidden />
      {contenido.texto}
    </Link>
  )
}
