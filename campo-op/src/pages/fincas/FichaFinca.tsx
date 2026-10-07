import { CalendarCheck, Navigation, Pencil, Sprout, Trash, UserRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { usePerfil } from '../../auth/contexto'
import { GaleriaFotos } from '../../components/GaleriaFotos'
import { Silueta } from '../../components/EditorRecintos'
import { Cabecera, Contenido } from '../../components/Layout'
import { Aviso, Boton, Cargando, Dialogo, EnlaceBoton, Insignia, Tarjeta, Vacio } from '../../components/ui'
import {
  useFinca,
  useFotosDeFinca,
  useNombresUsuarios,
  useRecintosDeFinca,
  useSinEnviar,
  useSocio,
} from '../../datos/consultas'
import { eliminar, modificar } from '../../datos/escritura'
import { nombreUsoSigpac } from '../../lib/catalogos'
import { descripcionTipo, enlaceComoLlegar, ubicacionFinca } from '../../lib/fincas'
import { formatearFecha, formatearFechaHora, formatearHa, formatearM2, haceDias, hoy } from '../../lib/formato'
import { nombreMunicipio, nombreProvincia, textoReferencia } from '../../lib/sigpac'
import { PROVINCIA_ALMERIA } from '../../lib/codigosSigpac'
import type { Finca } from '../../lib/tipos'

export function FichaFinca() {
  const { id } = useParams()
  const finca = useFinca(id)

  if (finca === undefined) {
    return (
      <>
        <Cabecera titulo="Finca" atras />
        <Cargando />
      </>
    )
  }
  if (finca === null) {
    return (
      <>
        <Cabecera titulo="Finca" atras="/fincas" />
        <Contenido>
          <Tarjeta>
            <Vacio
              icono={Sprout}
              titulo="Esta finca no existe"
              accion={<EnlaceBoton a="/fincas" variante="secundario">Ver todas las fincas</EnlaceBoton>}
            >
              Puede que se haya eliminado o que el enlace no sea correcto.
            </Vacio>
          </Tarjeta>
        </Contenido>
      </>
    )
  }
  return <Ficha finca={finca} />
}

function Ficha({ finca }: { finca: Finca }) {
  const perfil = usePerfil()
  const navegar = useNavigate()
  const socio = useSocio(finca.socio_id)
  const recintos = useRecintosDeFinca(finca.id) ?? []
  const fotos = useFotosDeFinca(finca.id) ?? []
  const sinEnviar = useSinEnviar('fincas', finca.id)
  const nombres = useNombresUsuarios()
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [registrando, setRegistrando] = useState(false)

  const ubicacion = ubicacionFinca(finca, recintos)
  const municipio = nombreMunicipio(finca.provincia, finca.municipio)
  const lugar = [municipio, finca.provincia !== PROVINCIA_ALMERIA ? nombreProvincia(finca.provincia) : ''].filter(Boolean).join(', ')
  const visitadaHoy = finca.fecha_ultima_visita === hoy()

  async function registrarVisita() {
    setRegistrando(true)
    await modificar('fincas', finca.id, { fecha_ultima_visita: hoy() })
    setRegistrando(false)
  }

  async function borrar() {
    setEliminando(true)
    await eliminar('fincas', finca.id)
    navegar('/fincas', { replace: true })
  }

  return (
    <>
      <Cabecera
        titulo={finca.nombre}
        subtitulo={socio ? `Socio ${socio.nombre}` : undefined}
        atras
        acciones={
          <EnlaceBoton a={`/fincas/${finca.id}/editar`} variante="fantasma" icono={Pencil}>
            <span className="sr-only sm:not-sr-only">Editar</span>
          </EnlaceBoton>
        }
      />
      <Contenido className="space-y-5">
        <Tarjeta className="p-4">
          <div className="flex flex-wrap gap-2">
            {finca.cultivo && <Insignia color="marca">{finca.cultivo}</Insignia>}
            {finca.campana && <Insignia>Campaña {finca.campana}</Insignia>}
            {descripcionTipo(finca) && <Insignia>{descripcionTipo(finca)}</Insignia>}
            {finca.certificaciones.map((c) => (
              <Insignia key={c} color="ambar">
                {c}
              </Insignia>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-stone-50 p-3">
              <p className="text-xl font-bold text-marca-800 tabular-nums">{formatearHa(finca.superficie_ha, 4)}</p>
              <p className="text-xs text-stone-500 tabular-nums">{formatearM2(finca.superficie_ha)}</p>
            </div>
            <div className="rounded-xl bg-stone-50 p-3">
              <p className="text-xl font-bold text-stone-900">{finca.fecha_ultima_visita ? haceDias(finca.fecha_ultima_visita) : 'Sin visitar'}</p>
              <p className="text-xs text-stone-500">{finca.fecha_ultima_visita ? formatearFecha(finca.fecha_ultima_visita) : 'última visita'}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {ubicacion ? (
              <a
                href={enlaceComoLlegar(ubicacion)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-marca-700 px-4 text-base font-semibold text-white shadow-sm hover:bg-marca-800 active:bg-marca-900"
              >
                <Navigation className="size-5" aria-hidden />
                Cómo llegar
              </a>
            ) : (
              <p className="flex min-h-12 items-center rounded-xl bg-stone-50 px-4 text-sm text-stone-500">
                Sin ubicación: añade un punto GPS o un recinto SIGPAC.
              </p>
            )}
            <Boton variante="secundario" icono={CalendarCheck} cargando={registrando} disabled={visitadaHoy} onClick={() => void registrarVisita()}>
              {visitadaHoy ? 'Visita de hoy registrada' : 'Registrar visita de hoy'}
            </Boton>
          </div>
        </Tarjeta>

        {sinEnviar ? (
          <Aviso tipo="aviso" titulo="Cambios sin enviar">
            Los últimos cambios de esta finca están guardados en el móvil y se enviarán al recuperar la conexión.
          </Aviso>
        ) : null}

        <Seccion titulo="Datos">
          <Tarjeta>
            <dl className="divide-y divide-stone-100">
              <Dato etiqueta="Socio">
                {socio && (
                  <Link to={`/socios/${socio.id}`} className="inline-flex items-center gap-1.5 font-medium text-marca-800 hover:underline">
                    <UserRound className="size-4" aria-hidden />
                    {socio.nombre}
                    <span className="font-normal text-stone-500">· {socio.codigo}</span>
                  </Link>
                )}
              </Dato>
              <Dato etiqueta="Municipio">{lugar}</Dato>
              <Dato etiqueta="Tipo">{descripcionTipo(finca)}</Dato>
              <Dato etiqueta="Superficie">
                {finca.superficie_ha !== null && `${formatearHa(finca.superficie_ha, 4)} · ${formatearM2(finca.superficie_ha)}`}
              </Dato>
              <Dato etiqueta="Cultivo actual">{finca.cultivo}</Dato>
              <Dato etiqueta="Campaña">{finca.campana}</Dato>
              <Dato etiqueta="Certificaciones">{finca.certificaciones.length ? finca.certificaciones.join(', ') : null}</Dato>
              <Dato etiqueta="Punto GPS">
                {finca.latitud !== null && finca.longitud !== null && (
                  <span className="tabular-nums">
                    {finca.latitud.toFixed(6).replace('.', ',')} · {finca.longitud.toFixed(6).replace('.', ',')}
                  </span>
                )}
              </Dato>
              <Dato etiqueta="Observaciones">
                {finca.observaciones && <span className="whitespace-pre-line">{finca.observaciones}</span>}
              </Dato>
            </dl>
          </Tarjeta>
        </Seccion>

        <Seccion titulo={`Recintos SIGPAC${recintos.length ? ` (${recintos.length})` : ''}`}>
          <Tarjeta className="overflow-hidden">
            {recintos.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-stone-500">
                Esta finca no tiene recintos SIGPAC. Puedes añadirlos al editarla.
              </p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {recintos.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 p-3">
                    <Silueta geometria={r.geometria} className="size-16" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-semibold text-stone-900">{textoReferencia(r)}</p>
                      <p className="truncate text-stone-600">{nombreMunicipio(r.provincia, r.municipio)}</p>
                      <p className="truncate text-stone-500">{nombreUsoSigpac(r.uso_sigpac) || 'Sin uso indicado'}</p>
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      <p className="font-semibold text-stone-800 tabular-nums">{formatearHa(r.superficie_ha, 4)}</p>
                      <p className="text-xs text-stone-500 tabular-nums">{formatearM2(r.superficie_ha)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </Seccion>

        <Seccion titulo={`Fotos${fotos.length ? ` (${fotos.length})` : ''}`}>
          <Tarjeta className="p-4">
            <GaleriaFotos idFinca={finca.id} fotos={fotos} />
          </Tarjeta>
        </Seccion>

        <p className="px-1 text-xs leading-relaxed text-stone-500">
          {sinEnviar ? (
            'Pendiente de enviar.'
          ) : (
            <>
              Última modificación: {formatearFechaHora(finca.updated_at)}
              {finca.updated_by && nombres?.get(finca.updated_by) && ` por ${nombres.get(finca.updated_by)}`}.
            </>
          )}
        </p>

        {perfil.rol === 'admin' && (
          <Boton variante="peligro" icono={Trash} bloque onClick={() => setConfirmarEliminar(true)}>
            Eliminar finca
          </Boton>
        )}
      </Contenido>

      <Dialogo
        abierto={confirmarEliminar}
        titulo={`¿Eliminar la finca «${finca.nombre}»?`}
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
        Se eliminarán también sus recintos SIGPAC y sus fotos.
      </Dialogo>
    </>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-semibold tracking-wide text-stone-500 uppercase">{titulo}</h2>
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
