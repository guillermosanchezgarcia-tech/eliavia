import { Crosshair, LoaderCircle, Plus, Search, Trash, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { nombreUsoSigpac } from '../lib/catalogos'
import { PROVINCIA_ALMERIA } from '../lib/codigosSigpac'
import { formatearHa } from '../lib/formato'
import { obtenerPosicion, textoPrecision } from '../lib/gps'
import {
  claveRecinto,
  nombreMunicipio,
  nombreProvincia,
  recintoEnPunto,
  textoReferencia,
  type RecintoBorrador,
  type RecintoSigpac,
} from '../lib/sigpac'
import { useConexion } from '../hooks/useConexion'
import { DialogoBuscarReferencia } from './BuscarReferencia'
import { Silueta } from './Silueta'
import { Aviso, Boton, Dialogo } from './ui'

export function EditorRecintos({ recintos, onChange, alObtenerPosicion }: {
  recintos: RecintoBorrador[]
  onChange: (recintos: RecintoBorrador[]) => void
  /** Se llama con la posición cuando se usa «desde mi posición». */
  alObtenerPosicion?: (latitud: number, longitud: number) => void
}) {
  const [dialogo, setDialogo] = useState<'referencia' | 'posicion' | null>(null)
  const conexion = useConexion()

  function añadir(nuevos: RecintoSigpac[]) {
    const ya = new Set(recintos.map(claveRecinto))
    const aAñadir = nuevos
      .filter((r) => !ya.has(claveRecinto(r)))
      .map((r) => ({ ...r, clave: crypto.randomUUID(), existente: false }))
    if (aAñadir.length) onChange([...recintos, ...aAñadir])
    return aAñadir.length
  }

  return (
    <div className="space-y-3">
      {recintos.length === 0 ? (
        <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-600">
          Todavía no hay recintos. Añade la referencia SIGPAC de la finca: se rellenan solos la superficie, el uso y el contorno.
        </p>
      ) : (
        <ul className="space-y-2">
          {recintos.map((r) => (
            <li key={r.clave} className="flex items-center gap-3 rounded-xl bg-stone-50 p-2.5">
              <Silueta geometria={r.geometria} className="size-14" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold text-stone-900">{textoReferencia(r)}</p>
                <p className="truncate text-stone-600">
                  {nombreMunicipio(r.provincia, r.municipio)}
                  {r.provincia !== PROVINCIA_ALMERIA && ` (${nombreProvincia(r.provincia)})`}
                </p>
                <p className="truncate text-stone-500">
                  {[r.superficie_ha !== null ? formatearHa(r.superficie_ha, 4) : null, nombreUsoSigpac(r.uso_sigpac)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChange(recintos.filter((x) => x.clave !== r.clave))}
                className="grid size-11 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-700"
                aria-label={`Quitar ${textoReferencia(r)}`}
              >
                <Trash className="size-5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!conexion && (
        <Aviso tipo="aviso">
          Sin conexión no se puede consultar el SIGPAC. Puedes guardar la finca ahora y añadir los recintos más tarde.
        </Aviso>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Boton variante="secundario" icono={Search} disabled={!conexion} onClick={() => setDialogo('referencia')}>
          Por referencia
        </Boton>
        <Boton variante="secundario" icono={Crosshair} disabled={!conexion} onClick={() => setDialogo('posicion')}>
          Mi posición
        </Boton>
      </div>

      <DialogoBuscarReferencia abierto={dialogo === 'referencia'} alCerrar={() => setDialogo(null)} onElegir={añadir} />
      <BuscarPorPosicion
        abierto={dialogo === 'posicion'}
        alCerrar={() => setDialogo(null)}
        onAñadir={añadir}
        alObtenerPosicion={alObtenerPosicion}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

function BuscarPorPosicion({ abierto, alCerrar, onAñadir, alObtenerPosicion }: {
  abierto: boolean
  alCerrar: () => void
  onAñadir: (r: RecintoSigpac[]) => number
  alObtenerPosicion?: (latitud: number, longitud: number) => void
}) {
  const [estado, setEstado] = useState<'buscando' | 'listo' | 'error'>('buscando')
  const [error, setError] = useState<string | null>(null)
  const [encontrado, setEncontrado] = useState<RecintoSigpac | null>(null)
  const [precision, setPrecision] = useState(0)
  const [intento, setIntento] = useState(0)
  // Se guarda aparte para que un cambio de esta función no repita la búsqueda.
  const avisarPosicion = useRef(alObtenerPosicion)
  useEffect(() => {
    avisarPosicion.current = alObtenerPosicion
  })

  useEffect(() => {
    if (!abierto) return
    let vigente = true
    ;(async () => {
      try {
        setEstado('buscando')
        const p = await obtenerPosicion()
        const r = await recintoEnPunto(p.latitud, p.longitud)
        if (!vigente) return
        setPrecision(p.precision)
        setEncontrado(r)
        setEstado('listo')
        avisarPosicion.current?.(p.latitud, p.longitud)
      } catch (e) {
        if (!vigente) return
        setError(e instanceof Error ? e.message : String(e))
        setEstado('error')
      }
    })()
    return () => {
      vigente = false
    }
  }, [abierto, intento])

  return (
    <Dialogo
      abierto={abierto}
      titulo="Recinto en mi posición"
      alCerrar={alCerrar}
      acciones={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            {estado === 'listo' && encontrado ? 'Cancelar' : 'Cerrar'}
          </Boton>
          {estado === 'listo' && encontrado ? (
            <Boton
              icono={Plus}
              onClick={() => {
                onAñadir([encontrado])
                alCerrar()
              }}
            >
              Añadir recinto
            </Boton>
          ) : (
            estado !== 'buscando' && (
              <Boton icono={Crosshair} onClick={() => setIntento((n) => n + 1)}>
                Reintentar
              </Boton>
            )
          )}
        </>
      }
    >
      {estado === 'buscando' && (
        <p className="flex items-center gap-3 py-4">
          <LoaderCircle className="size-6 animate-spin text-marca-600" aria-hidden />
          Obteniendo tu posición…
        </p>
      )}
      {estado === 'error' && <Aviso tipo="error">{error}</Aviso>}
      {estado === 'listo' && !encontrado && (
        <Aviso tipo="aviso" titulo="No hay recinto SIGPAC aquí">
          La posición obtenida ({textoPrecision(precision)}) no cae dentro de ningún recinto. Acércate más al centro de la finca o búscalo por referencia.
        </Aviso>
      )}
      {estado === 'listo' && encontrado && (
        <div className="space-y-3">
          <p>
            Estás dentro de este recinto <span className="text-stone-500">(precisión {textoPrecision(precision)})</span>:
          </p>
          <div className="flex items-center gap-3 rounded-xl bg-marca-50 p-2.5 ring-1 ring-marca-600">
            <Silueta geometria={encontrado.geometria} className="size-16" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-stone-900">{textoReferencia(encontrado)}</p>
              <p className="text-stone-600">{nombreMunicipio(encontrado.provincia, encontrado.municipio)}</p>
              <p className="text-stone-500">
                {[formatearHa(encontrado.superficie_ha, 4), nombreUsoSigpac(encontrado.uso_sigpac)].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
          {precision > 30 && (
            <p className="flex gap-2 text-amber-800">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              La precisión es baja: comprueba que es el recinto correcto antes de añadirlo.
            </p>
          )}
        </div>
      )}
    </Dialogo>
  )
}
