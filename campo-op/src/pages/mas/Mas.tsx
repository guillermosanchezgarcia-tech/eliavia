import { useLiveQuery } from 'dexie-react-hooks'
import { ChartNoAxesColumn, ChevronRight, Download, KeyRound, LogOut, MapPinned, Pencil, RefreshCw, Share, Smartphone, UserCog } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useAuth, usePerfil } from '../../auth/contexto'
import { Cabecera, Contenido } from '../../components/Layout'
import { Aviso, Boton, Campo, Dialogo, FilaEnlace, Insignia, Tarjeta } from '../../components/ui'
import { useAjuste, usePendientes } from '../../datos/consultas'
import { db } from '../../datos/db'
import { formatearBytes } from '../../mapa/teselas'
import { useDescarga } from '../../mapa/zonas'
import { CLAVE_ULTIMA_SINCRONIZACION } from '../../datos/sincronizacion'
import { config } from '../../config'
import { useConexion } from '../../hooks/useConexion'
import { useInstalacion } from '../../hooks/useInstalacion'
import { mensajeDeError } from '../../lib/errores'
import { haceCuanto, iniciales } from '../../lib/formato'
import { esIOS, estaInstalada, instalar } from '../../lib/instalacion'
import { supabase } from '../../lib/supabase'
import { NOMBRES_ROL } from '../../lib/tipos'

export function Mas() {
  const perfil = usePerfil()
  const { cerrarSesion } = useAuth()
  const [saliendo, setSaliendo] = useState(false)
  const [avisoSalir, setAvisoSalir] = useState(false)
  const pendientes = usePendientes()
  const ultima = useAjuste<string>(CLAVE_ULTIMA_SINCRONIZACION)
  const sinEnviar = pendientes?.length ?? 0
  const conError = pendientes?.filter((p) => p.error).length ?? 0
  const zonas = useLiveQuery(() => db.zonas.toArray(), [])
  const descarga = useDescarga()

  async function salir() {
    setSaliendo(true)
    await cerrarSesion()
  }

  return (
    <>
      <Cabecera titulo="Más" />
      <Contenido className="space-y-6">
        <Tarjeta className="flex items-center gap-4 p-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-marca-700 text-lg font-bold text-white">
            {iniciales(perfil.nombre || perfil.email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-stone-900">{perfil.nombre || 'Sin nombre'}</p>
            <p className="truncate text-sm text-stone-500">{perfil.email}</p>
            <div className="mt-1">
              <Insignia color={perfil.rol === 'admin' ? 'marca' : 'gris'}>{NOMBRES_ROL[perfil.rol]}</Insignia>
            </div>
          </div>
        </Tarjeta>

        <Seccion titulo="Datos de la OP">
          <FilaEnlace
            a="/informes"
            icono={ChartNoAxesColumn}
            titulo="Informes y Excel"
            detalle="Totales por cultivo, municipio y certificación"
            derecha={<Flecha />}
          />
        </Seccion>

        <Seccion titulo="Mi cuenta">
          <EditarNombre />
          <FilaEnlace a="/mas/clave" icono={KeyRound} titulo="Cambiar contraseña" derecha={<Flecha />} />
        </Seccion>

        {perfil.rol === 'admin' && (
          <Seccion titulo="Administración">
            <FilaEnlace
              a="/mas/usuarios"
              icono={UserCog}
              titulo="Usuarios y técnicos"
              detalle="Roles y acceso a la app"
              derecha={<Flecha />}
            />
          </Seccion>
        )}

        <Seccion titulo="Aplicación">
          <FilaEnlace
            a="/mas/sincronizacion"
            icono={RefreshCw}
            titulo="Sincronización"
            detalle={
              conError
                ? `${conError} ${conError === 1 ? 'cambio rechazado' : 'cambios rechazados'}`
                : sinEnviar
                  ? `${sinEnviar} ${sinEnviar === 1 ? 'cambio' : 'cambios'} sin enviar`
                  : `Al día · última ${haceCuanto(ultima)}`
            }
            derecha={<Flecha />}
          />
          <FilaEnlace
            a="/mas/mapas"
            icono={MapPinned}
            titulo="Mapas sin conexión"
            detalle={
              descarga
                ? `Descargando… ${descarga.total ? Math.floor((descarga.hechas / descarga.total) * 100) : 0} %`
                : zonas?.length
                  ? `${zonas.length} ${zonas.length === 1 ? 'zona' : 'zonas'} · ${formatearBytes(zonas.reduce((s, z) => s + z.bytes, 0))}`
                  : 'Descarga el mapa para verlo sin cobertura'
            }
            derecha={<Flecha />}
          />
          <InstalarApp />
          <div className="flex items-center justify-between px-4 py-3 text-sm text-stone-500">
            <span>
              {config.nombreApp} · {config.nombreOP}
            </span>
            <span>Versión {__FECHA_VERSION__}</span>
          </div>
        </Seccion>

        <Boton
          variante="peligro"
          icono={LogOut}
          cargando={saliendo}
          bloque
          onClick={() => (sinEnviar ? setAvisoSalir(true) : void salir())}
        >
          Cerrar sesión
        </Boton>
      </Contenido>

      <Dialogo
        abierto={avisoSalir}
        titulo="Tienes cambios sin enviar"
        alCerrar={() => setAvisoSalir(false)}
        acciones={
          <>
            <Boton variante="secundario" onClick={() => setAvisoSalir(false)}>
              No cerrar sesión
            </Boton>
            <Boton variante="eliminar" cargando={saliendo} onClick={() => void salir()}>
              Cerrar y perderlos
            </Boton>
          </>
        }
      >
        Hay {sinEnviar} {sinEnviar === 1 ? 'cambio que no ha llegado' : 'cambios que no han llegado'} al servidor. Si
        cierras sesión ahora se perderán. Espera a tener cobertura para que se envíen.
      </Dialogo>
    </>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-semibold tracking-wide text-stone-500 uppercase">{titulo}</h2>
      <Tarjeta className="divide-y divide-stone-100 overflow-hidden">{children}</Tarjeta>
    </section>
  )
}

function Flecha() {
  return <ChevronRight className="size-5 text-stone-400" aria-hidden />
}

function EditarNombre() {
  const perfil = usePerfil()
  const { recargarPerfil } = useAuth()
  const conexion = useConexion()
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(perfil.nombre ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    const { error } = await supabase.from('perfiles').update({ nombre: nombre.trim() || null }).eq('id', perfil.id)
    setGuardando(false)
    if (error) {
      setError(mensajeDeError(error))
      return
    }
    await recargarPerfil()
    setEditando(false)
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-stone-50 active:bg-stone-100"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-marca-50 text-marca-700">
          <Pencil className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-stone-900">Mi nombre</span>
          <span className="block truncate text-sm text-stone-500">{perfil.nombre || 'Sin nombre'}</span>
        </span>
        <Flecha />
      </button>
    )
  }

  return (
    <form onSubmit={guardar} className="space-y-3 p-4">
      {error && <Aviso tipo="error">{error}</Aviso>}
      {!conexion && <Aviso tipo="aviso">Necesitas conexión para cambiar tu nombre.</Aviso>}
      <Campo etiqueta="Nombre y apellidos" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
      <div className="flex gap-2">
        <Boton variante="secundario" className="flex-1" onClick={() => setEditando(false)}>
          Cancelar
        </Boton>
        <Boton type="submit" className="flex-1" cargando={guardando} disabled={!conexion}>
          Guardar
        </Boton>
      </div>
    </form>
  )
}

function InstalarApp() {
  const disponible = useInstalacion()
  const [verPasosIOS, setVerPasosIOS] = useState(false)

  if (estaInstalada()) {
    return (
      <div className="flex min-h-14 items-center gap-3 px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-marca-50 text-marca-700">
          <Smartphone className="size-5" aria-hidden />
        </span>
        <span className="text-stone-700">La app está instalada en este dispositivo.</span>
      </div>
    )
  }

  if (disponible) {
    return (
      <button
        type="button"
        onClick={() => void instalar()}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-stone-50 active:bg-stone-100"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-marca-700 text-white">
          <Download className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-stone-900">Instalar la app</span>
          <span className="block text-sm text-stone-500">Añádela a la pantalla de inicio del móvil</span>
        </span>
      </button>
    )
  }

  return (
    <div className="px-4 py-3">
      <button
        type="button"
        onClick={() => setVerPasosIOS((v) => !v)}
        className="flex min-h-11 w-full items-center gap-3 text-left"
        aria-expanded={verPasosIOS}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-marca-50 text-marca-700">
          <Smartphone className="size-5" aria-hidden />
        </span>
        <span className="flex-1 font-medium text-stone-900">Cómo instalar la app en el móvil</span>
      </button>
      {verPasosIOS && (
        <ol className="mt-3 list-decimal space-y-2 pl-6 text-sm leading-relaxed text-stone-600">
          {esIOS() ? (
            <>
              <li>Abre esta página en <strong>Safari</strong>.</li>
              <li>
                Pulsa el botón <strong>Compartir</strong> <Share className="inline size-4 align-text-bottom" aria-label="(icono compartir)" />.
              </li>
              <li>
                Elige <strong>«Añadir a pantalla de inicio»</strong> y confirma.
              </li>
            </>
          ) : (
            <>
              <li>Abre esta página en <strong>Chrome</strong>.</li>
              <li>Pulsa el menú <strong>⋮</strong> de arriba a la derecha.</li>
              <li>
                Elige <strong>«Instalar aplicación»</strong> o <strong>«Añadir a pantalla de inicio»</strong>.
              </li>
            </>
          )}
        </ol>
      )}
    </div>
  )
}
