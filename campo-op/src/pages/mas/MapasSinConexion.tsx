import { useLiveQuery } from 'dexie-react-hooks'
import { CircleCheck, CloudDownload, HardDrive, Map as IconoMapa, MapPinned, RotateCcw, Sprout, Trash2, TriangleAlert, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { DialogoDescargarZona } from '../../components/DescargarZona'
import { Cabecera, Contenido } from '../../components/Layout'
import { Aviso, Boton, Cargando, Dialogo, Insignia, Tarjeta, Vacio } from '../../components/ui'
import { useFincas, useRecintos, useSocios } from '../../datos/consultas'
import { db, type ZonaMapa } from '../../datos/db'
import { useConexion } from '../../hooks/useConexion'
import { mensajeDeError } from '../../lib/errores'
import { formatearFecha, formatearNumero } from '../../lib/formato'
import { prepararFincas, unirLimites, type Limites } from '../../mapa/datos'
import { areasDeFincas, formatearBytes } from '../../mapa/teselas'
import {
  borrarZona,
  cancelarDescarga,
  completarZona,
  espacioDelMovil,
  olvidarAviso,
  useDescarga,
  useUltimoAviso,
} from '../../mapa/zonas'

const NOMBRE_DETALLE: Record<number, string> = { 17: 'detalle básico', 18: 'detalle normal', 19: 'detalle máximo' }

export function MapasSinConexion() {
  const navegar = useNavigate()
  const conexion = useConexion()
  const zonas = useLiveQuery(() => db.zonas.orderBy('creada').reverse().toArray(), [])
  const enCurso = useDescarga()
  const aviso = useUltimoAviso()
  const [espacio, setEspacio] = useState<Awaited<ReturnType<typeof espacioDelMovil>>>(null)
  const [dialogoFincas, setDialogoFincas] = useState(false)
  const [aBorrar, setABorrar] = useState<ZonaMapa | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fincas = useFincas()
  const recintos = useRecintos()
  const socios = useSocios()
  const limitesFincas = useMemo(() => {
    if (!fincas || !recintos || !socios) return []
    return prepararFincas(fincas, recintos, socios)
      .map((f) => f.limites)
      .filter((l): l is Limites => l !== null)
  }, [fincas, recintos, socios])
  const areasPara = useCallback((detalle: number) => areasDeFincas(limitesFincas, detalle), [limitesFincas])

  // El espacio usado cambia al descargar y al borrar.
  const ocupado = zonas?.reduce((s, z) => s + z.bytes, 0) ?? 0
  const hayDescarga = enCurso !== null
  useEffect(() => {
    void espacioDelMovil().then(setEspacio)
  }, [ocupado, hayDescarga])

  async function completar(z: ZonaMapa) {
    setError(null)
    try {
      // La zona de las fincas se pone al día con las fincas nuevas.
      await completarZona(z.id, z.tipo === 'fincas' ? areasDeFincas(limitesFincas, z.detalle) : undefined)
    } catch (e) {
      setError(mensajeDeError(e))
    }
  }

  async function confirmarBorrado() {
    if (!aBorrar) return
    setBorrando(true)
    try {
      await borrarZona(aBorrar.id)
      setABorrar(null)
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setBorrando(false)
    }
  }

  function verEnMapa(z: ZonaMapa) {
    const limites = unirLimites(z.areas.filter((a) => a.zMax >= 14).map((a) => a.limites))
    if (!limites) return
    const [[s, o], [n, e]] = limites
    navegar(`/mapa?zona=${[s, o, n, e].map((v) => v.toFixed(5)).join(',')}`)
  }

  const yaHayDeFincas = zonas?.some((z) => z.tipo === 'fincas')

  return (
    <>
      <Cabecera titulo="Mapas sin conexión" atras="/mas" />
      <Contenido className="space-y-5">
        <Aviso tipo="info">
          Descarga la ortofoto y los recintos SIGPAC de una zona para verlos en el campo aunque no haya cobertura. Hazlo con
          wifi antes de salir.
        </Aviso>

        {aviso && !enCurso && (
          <div className="relative">
            <Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso>
            <button
              type="button"
              onClick={olvidarAviso}
              aria-label="Cerrar aviso"
              className="absolute top-1.5 right-1.5 grid size-9 place-items-center rounded-lg text-stone-500 hover:bg-black/5"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        )}
        {error && <Aviso tipo="error">{error}</Aviso>}

        {enCurso && <TarjetaProgreso />}

        <section className="grid gap-3 sm:grid-cols-2">
          <Tarjeta className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-marca-50 text-marca-700">
                <Sprout className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="font-semibold text-stone-900">Alrededor de mis fincas</h2>
                <p className="text-sm text-stone-600">
                  Cada finca con sus alrededores, y una vista general de toda la zona.{' '}
                  {formatearNumero(limitesFincas.length)} {limitesFincas.length === 1 ? 'finca tiene' : 'fincas tienen'} ubicación.
                </p>
              </div>
            </div>
            <Boton
              icono={CloudDownload}
              className="mt-auto"
              disabled={!conexion || Boolean(enCurso) || limitesFincas.length === 0}
              onClick={() => setDialogoFincas(true)}
            >
              {yaHayDeFincas ? 'Descargar otra vez' : 'Descargar'}
            </Boton>
          </Tarjeta>
          <Tarjeta className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-marca-50 text-marca-700">
                <MapPinned className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="font-semibold text-stone-900">Una zona del mapa</h2>
                <p className="text-sm text-stone-600">
                  Mueve el mapa hasta la zona que quieras (un paraje, un término municipal…) y descárgala tal como se ve.
                </p>
              </div>
            </div>
            <Boton icono={IconoMapa} variante="secundario" className="mt-auto" onClick={() => navegar('/mapa?descargar=1')}>
              Elegir en el mapa
            </Boton>
          </Tarjeta>
        </section>

        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold tracking-wide text-stone-500 uppercase">Zonas descargadas</h2>
          {zonas === undefined ? (
            <Cargando />
          ) : zonas.length === 0 ? (
            <Tarjeta>
              <Vacio icono={IconoMapa} titulo="Aún no hay zonas descargadas">
                Sin cobertura, el mapa solo se ve donde ya se había mirado antes.
              </Vacio>
            </Tarjeta>
          ) : (
            <Tarjeta className="divide-y divide-stone-100 overflow-hidden">
              {zonas.map((z) => (
                <FilaZona
                  key={z.id}
                  zona={z}
                  descargando={enCurso?.zonaId === z.id}
                  bloqueado={Boolean(enCurso) || !conexion}
                  alCompletar={() => void completar(z)}
                  alVer={() => verEnMapa(z)}
                  alBorrar={() => setABorrar(z)}
                />
              ))}
            </Tarjeta>
          )}
        </section>

        {espacio && (
          <Tarjeta className="flex items-start gap-3 p-4 text-sm text-stone-600">
            <HardDrive className="mt-0.5 size-5 shrink-0 text-stone-400" aria-hidden />
            <div>
              <p>
                Mapas descargados: <strong>{formatearBytes(ocupado)}</strong>. Libre para la app: {formatearBytes(espacio.disponible)}.
              </p>
              {!espacio.persistente && ocupado > 0 && (
                <p className="mt-1 text-stone-500">
                  Si el móvil se queda sin espacio podría borrar los mapas. Instalar la app en la pantalla de inicio lo evita.
                </p>
              )}
            </div>
          </Tarjeta>
        )}
      </Contenido>

      <DialogoDescargarZona
        abierto={dialogoFincas}
        alCerrar={() => setDialogoFincas(false)}
        titulo="Descargar alrededor de mis fincas"
        tipo="fincas"
        nombreInicial="Mis fincas"
        areasPara={areasPara}
        explicacion="Se descarga el mapa de cada finca con unos 150 m alrededor, y la comarca con menos detalle para orientarse."
      />

      <Dialogo
        abierto={aBorrar !== null}
        titulo="¿Borrar esta zona?"
        alCerrar={() => setABorrar(null)}
        acciones={
          <>
            <Boton variante="secundario" onClick={() => setABorrar(null)}>
              No borrar
            </Boton>
            <Boton variante="eliminar" icono={Trash2} cargando={borrando} onClick={() => void confirmarBorrado()}>
              Borrar
            </Boton>
          </>
        }
      >
        Se libera {formatearBytes(aBorrar?.bytes ?? 0)} del móvil. Las fincas y los socios no se tocan: solo el mapa de «
        {aBorrar?.nombre}», que podrás volver a descargar cuando quieras.
      </Dialogo>
    </>
  )
}

function TarjetaProgreso() {
  const p = useDescarga()
  if (!p) return null
  const porcentaje = p.total ? Math.floor((p.hechas / p.total) * 100) : 0
  return (
    <Tarjeta className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate font-semibold text-stone-900">Descargando «{p.nombre}»</p>
        <span className="shrink-0 text-sm font-semibold text-marca-800 tabular-nums">{porcentaje} %</span>
      </div>
      <div
        className="h-3 overflow-hidden rounded-full bg-stone-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={porcentaje}
        aria-label="Progreso de la descarga"
      >
        <div className="h-full rounded-full bg-marca-600 transition-[width]" style={{ width: `${porcentaje}%` }} />
      </div>
      <p className="text-sm text-stone-600 tabular-nums">
        {formatearNumero(p.hechas)} de {formatearNumero(p.total)} imágenes · {formatearBytes(p.bytes)}
        {p.fallidas > 0 && ` · ${formatearNumero(p.fallidas)} fallidas`}
      </p>
      <Boton variante="secundario" bloque cargando={p.cancelando} onClick={cancelarDescarga}>
        {p.cancelando ? 'Cancelando…' : 'Cancelar descarga'}
      </Boton>
    </Tarjeta>
  )
}

function FilaZona({ zona: z, descargando, bloqueado, alCompletar, alVer, alBorrar }: {
  zona: ZonaMapa
  descargando: boolean
  bloqueado: boolean
  alCompletar: () => void
  alVer: () => void
  alBorrar: () => void
}) {
  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex items-start gap-3">
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-lg ${
            z.estado === 'completa' ? 'bg-marca-50 text-marca-700' : 'bg-amber-50 text-amber-700'
          }`}
        >
          {z.estado === 'completa' ? (
            <CircleCheck className="size-5" aria-hidden />
          ) : (
            <TriangleAlert className="size-5" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-stone-900">{z.nombre}</p>
          <p className="text-sm text-stone-500">
            {formatearBytes(z.bytes)} · {NOMBRE_DETALLE[z.detalle] ?? `detalle ${z.detalle}`} · {formatearFecha(z.actualizada.slice(0, 10))}
          </p>
          <div className="mt-1">
            {descargando ? (
              <Insignia color="marca">Descargando…</Insignia>
            ) : z.estado === 'completa' ? (
              <Insignia color="marca">Lista para usar sin conexión</Insignia>
            ) : (
              <Insignia color="ambar">
                Incompleta · faltan {formatearNumero(Math.max(0, z.teselas - z.descargadas))} imágenes
              </Insignia>
            )}
          </div>
        </div>
      </div>
      {!descargando && (
        <div className="flex flex-wrap gap-2">
          <Boton variante="secundario" icono={IconoMapa} className="min-h-10 flex-1 text-sm" onClick={alVer}>
            Ver en el mapa
          </Boton>
          {(z.estado !== 'completa' || z.tipo === 'fincas') && (
            <Boton
              variante="secundario"
              icono={RotateCcw}
              className="min-h-10 flex-1 text-sm"
              disabled={bloqueado}
              onClick={alCompletar}
            >
              {z.estado === 'completa' ? 'Añadir fincas nuevas' : 'Completar'}
            </Boton>
          )}
          <Boton variante="peligro" icono={Trash2} className="min-h-10 text-sm" onClick={alBorrar} aria-label={`Borrar ${z.nombre}`}>
            Borrar
          </Boton>
        </div>
      )}
    </div>
  )
}
