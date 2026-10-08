import { CloudUpload, Mail, Map as MapIcon, MapPin, MessageCircle, Pencil, Phone, Plus, Sprout, Trash, UserX } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { usePerfil } from '../../auth/contexto'
import { Cabecera, Contenido } from '../../components/Layout'
import { Aviso, Boton, Cargando, Dialogo, EnlaceBoton, Insignia, Tarjeta, Vacio } from '../../components/ui'
import { useFincasDeSocio, useNombresUsuarios, useSinEnviar, useSocio } from '../../datos/consultas'
import { eliminar } from '../../datos/escritura'
import { descripcionTipo } from '../../lib/fincas'
import { formatearFecha, formatearFechaHora, formatearHa, formatearM2, iniciales } from '../../lib/formato'
import type { Finca, Socio } from '../../lib/tipos'
import { esMovilEspanol, esTelefonoEspanol, limpiarTelefono } from '../../lib/validacion'

export function FichaSocio() {
  const { id } = useParams()
  const socio = useSocio(id)

  if (socio === undefined) {
    return (
      <>
        <Cabecera titulo="Socio" atras />
        <Cargando />
      </>
    )
  }
  if (socio === null) {
    return (
      <>
        <Cabecera titulo="Socio" atras="/socios" />
        <Contenido>
          <Tarjeta>
            <Vacio
              icono={UserX}
              titulo="Este socio no existe"
              accion={<EnlaceBoton a="/socios" variante="secundario">Ver todos los socios</EnlaceBoton>}
            >
              Puede que se haya eliminado o que el enlace no sea correcto.
            </Vacio>
          </Tarjeta>
        </Contenido>
      </>
    )
  }
  return <Ficha socio={socio} />
}

function Ficha({ socio }: { socio: Socio }) {
  const perfil = usePerfil()
  const navegar = useNavigate()
  const fincas = useFincasDeSocio(socio.id)
  const nombres = useNombresUsuarios()
  const sinEnviar = useSinEnviar('socios', socio.id)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  const baja = socio.estado === 'baja'
  const totalHa = (fincas ?? []).reduce((suma, f) => suma + (f.superficie_ha ?? 0), 0)
  const telefono = socio.telefono ? limpiarTelefono(socio.telefono) : ''
  const direccionCompleta = [socio.direccion, [socio.codigo_postal, socio.localidad].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')

  async function borrar() {
    setEliminando(true)
    await eliminar('socios', socio.id)
    navegar('/socios', { replace: true })
  }

  return (
    <>
      <Cabecera
        titulo={socio.nombre}
        subtitulo={`Socio ${socio.codigo}`}
        atras
        acciones={
          <EnlaceBoton a={`/socios/${socio.id}/editar`} variante="fantasma" icono={Pencil}>
            <span className="sr-only sm:not-sr-only">Editar</span>
          </EnlaceBoton>
        }
      />
      <Contenido className="space-y-5">
        <Tarjeta className="p-4">
          <div className="flex items-center gap-4">
            <span
              className={`grid size-14 shrink-0 place-items-center rounded-full text-lg font-bold ${
                baja ? 'bg-stone-100 text-stone-500' : 'bg-marca-700 text-white'
              }`}
              aria-hidden
            >
              {iniciales(socio.nombre) || '?'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-lg leading-snug font-bold text-stone-900">{socio.nombre}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {baja ? <Insignia color="rojo">De baja</Insignia> : <Insignia color="marca">Activo</Insignia>}
                {socio.nif && <span className="text-sm text-stone-500">{socio.nif}</span>}
              </div>
            </div>
          </div>

          {(telefono || socio.email) && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {telefono && (
                <AccionContacto
                  href={`tel:${esTelefonoEspanol(telefono) ? `+34${telefono}` : socio.telefono}`}
                  icono={<Phone className="size-5" aria-hidden />}
                  texto="Llamar"
                />
              )}
              {telefono && esMovilEspanol(telefono) && (
                <AccionContacto
                  href={`https://wa.me/34${telefono}`}
                  icono={<MessageCircle className="size-5" aria-hidden />}
                  texto="WhatsApp"
                  externo
                />
              )}
              {socio.email && (
                <AccionContacto
                  href={`mailto:${socio.email}`}
                  icono={<Mail className="size-5" aria-hidden />}
                  texto="Email"
                />
              )}
            </div>
          )}
        </Tarjeta>

        {sinEnviar ? (
          <Aviso tipo="aviso" titulo="Cambios sin enviar">
            Los últimos cambios de este socio están guardados en el móvil y se enviarán al recuperar la conexión.
          </Aviso>
        ) : null}

        <Seccion titulo="Datos">
          <Tarjeta>
            <dl className="divide-y divide-stone-100">
              <Dato etiqueta="Código de socio">{socio.codigo}</Dato>
              <Dato etiqueta="NIF / CIF">{socio.nif}</Dato>
              <Dato etiqueta="Teléfono">{socio.telefono}</Dato>
              <Dato etiqueta="Email">{socio.email}</Dato>
              <Dato etiqueta="Dirección">
                {direccionCompleta && (
                  <>
                    {direccionCompleta}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccionCompleta)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 flex items-center gap-1 text-sm font-medium text-marca-800 hover:underline"
                    >
                      <MapPin className="size-4" aria-hidden />
                      Ver en Google Maps
                    </a>
                  </>
                )}
              </Dato>
              <Dato etiqueta="Fecha de alta">{formatearFecha(socio.fecha_alta)}</Dato>
              {baja && <Dato etiqueta="Fecha de baja">{formatearFecha(socio.fecha_baja)}</Dato>}
              <Dato etiqueta="Observaciones">
                {socio.observaciones && <span className="whitespace-pre-line">{socio.observaciones}</span>}
              </Dato>
            </dl>
          </Tarjeta>
        </Seccion>

        <Seccion
          titulo={`Fincas${fincas?.length ? ` (${fincas.length})` : ''}`}
          extra={fincas?.length ? <span className="text-sm font-semibold text-stone-700">{formatearHa(totalHa)}</span> : null}
        >
          <Tarjeta className="overflow-hidden">
            {fincas === undefined ? (
              <Cargando />
            ) : fincas.length === 0 ? (
              <Vacio icono={Sprout} titulo="Sin fincas todavía">
                Las fincas de este socio aparecerán aquí.
              </Vacio>
            ) : (
              <ul className="divide-y divide-stone-100">
                {fincas.map((f) => (
                  <FilaFinca key={f.id} finca={f} />
                ))}
              </ul>
            )}
          </Tarjeta>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <EnlaceBoton a={`/fincas/nueva?socio=${socio.id}`} variante="secundario" icono={Plus}>
              Añadir finca
            </EnlaceBoton>
            {fincas && fincas.length > 0 && (
              <EnlaceBoton a={`/mapa?socio=${socio.id}`} variante="secundario" icono={MapIcon}>
                Ver en el mapa
              </EnlaceBoton>
            )}
          </div>
        </Seccion>

        <p className="px-1 text-xs leading-relaxed text-stone-500">
          {sinEnviar ? (
            <span className="inline-flex items-center gap-1">
              <CloudUpload className="size-3.5" aria-hidden />
              Pendiente de enviar.
            </span>
          ) : (
            <>
              Última modificación: {formatearFechaHora(socio.updated_at)}
              {socio.updated_by && nombres?.get(socio.updated_by) && ` por ${nombres.get(socio.updated_by)}`}.
            </>
          )}
        </p>

        {perfil.rol === 'admin' && (
          <Boton variante="peligro" icono={Trash} bloque onClick={() => setConfirmarEliminar(true)}>
            Eliminar socio
          </Boton>
        )}
      </Contenido>

      <Dialogo
        abierto={confirmarEliminar}
        titulo={`¿Eliminar a ${socio.nombre}?`}
        alCerrar={() => setConfirmarEliminar(false)}
        acciones={
          <>
            <Boton variante="secundario" onClick={() => setConfirmarEliminar(false)}>
              Cancelar
            </Boton>
            <Boton variante="eliminar" cargando={eliminando} onClick={() => void borrar()}>
              Eliminar
            </Boton>
          </>
        }
      >
        {fincas?.length
          ? `Se eliminará el socio y sus ${fincas.length === 1 ? 'finca' : `${fincas.length} fincas`}. `
          : 'Se eliminará el socio. '}
        Si solo ha dejado la OP, es mejor editarlo y marcarlo «De baja» para conservar su historial.
      </Dialogo>
    </>
  )
}

function Seccion({ titulo, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  )
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-stone-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-stone-900 sm:col-span-2 sm:mt-0">{children || <span className="text-stone-400">—</span>}</dd>
    </div>
  )
}

function AccionContacto({ href, icono, texto, externo = false }: {
  href: string
  icono: ReactNode
  texto: string
  externo?: boolean
}) {
  return (
    <a
      href={href}
      {...(externo ? { target: '_blank', rel: 'noreferrer' } : {})}
      className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl bg-marca-50 text-sm font-semibold text-marca-800 ring-1 ring-marca-100 transition hover:bg-marca-100 active:bg-marca-200"
    >
      {icono}
      {texto}
    </a>
  )
}

function FilaFinca({ finca }: { finca: Finca }) {
  const tipo = descripcionTipo(finca)
  return (
    <li>
      <Link to={`/fincas/${finca.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-stone-50 active:bg-stone-100">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-marca-50 text-marca-700" aria-hidden>
          <Sprout className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-stone-900">{finca.nombre}</span>
          <span className="block truncate text-sm text-stone-500">
            {[finca.cultivo, tipo, finca.campana].filter(Boolean).join(' · ') || 'Sin datos de cultivo'}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold text-stone-800 tabular-nums">{formatearHa(finca.superficie_ha)}</span>
          {finca.superficie_ha !== null && (
            <span className="block text-xs text-stone-500 tabular-nums">{formatearM2(finca.superficie_ha)}</span>
          )}
        </span>
      </Link>
    </li>
  )
}
