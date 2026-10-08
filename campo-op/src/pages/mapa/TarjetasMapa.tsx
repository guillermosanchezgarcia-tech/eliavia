import { useLiveQuery } from 'dexie-react-hooks'
import { Navigation, Plus, Sprout, TriangleAlert, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Silueta } from '../../components/Silueta'
import { Boton, EnlaceBoton, Insignia } from '../../components/ui'
import { useFinca, useRecintosDeFinca, useSocio } from '../../datos/consultas'
import { centroDe, fincasDeRecinto } from '../../mapa/datos'
import { nombreUsoSigpac } from '../../lib/catalogos'
import { cx } from '../../lib/cx'
import { descripcionTipo, enlaceComoLlegar, ubicacionFinca } from '../../lib/fincas'
import { formatearHa, formatearM2 } from '../../lib/formato'
import { claveRecinto, nombreMunicipio, nombreProvincia, textoReferencia, type RecintoSigpac } from '../../lib/sigpac'
import { PROVINCIA_ALMERIA } from '../../lib/codigosSigpac'

function Tarjeta({ children, alCerrar, etiquetaCerrar }: { children: React.ReactNode; alCerrar: () => void; etiquetaCerrar: string }) {
  return (
    <section className="pointer-events-auto relative w-full max-w-xl rounded-2xl bg-white p-4 shadow-xl ring-1 ring-stone-200">
      <button
        type="button"
        onClick={alCerrar}
        className="absolute top-1.5 right-1.5 grid size-11 place-items-center rounded-full text-stone-500 hover:bg-stone-100"
        aria-label={etiquetaCerrar}
      >
        <X className="size-5" aria-hidden />
      </button>
      {children}
    </section>
  )
}

function EnlaceLlegar({ latitud, longitud }: { latitud: number; longitud: number }) {
  return (
    <a
      href={enlaceComoLlegar({ latitud, longitud })}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-marca-700 px-4 text-base font-semibold text-white shadow-sm hover:bg-marca-800 active:bg-marca-900"
    >
      <Navigation className="size-5" aria-hidden />
      Cómo llegar
    </a>
  )
}

/** Una finca elegida en el mapa. */
export function TarjetaFinca({ id, alCerrar }: { id: string; alCerrar: () => void }) {
  const finca = useFinca(id)
  const socio = useSocio(finca?.socio_id)
  const recintos = useRecintosDeFinca(id) ?? []
  if (!finca) return null
  const ubicacion = ubicacionFinca(finca, recintos)
  const tipo = descripcionTipo(finca)
  return (
    <Tarjeta alCerrar={alCerrar} etiquetaCerrar="Cerrar la ficha de la finca">
      <div className="flex items-start gap-3 pr-10">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-marca-50 text-marca-700" aria-hidden>
          <Sprout className="size-6" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-lg leading-tight font-bold text-stone-900">{finca.nombre}</h2>
          <p className="truncate text-sm text-stone-500">
            {[socio?.nombre, nombreMunicipio(finca.provincia, finca.municipio)].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {finca.cultivo && <Insignia color="marca">{finca.cultivo}</Insignia>}
        {tipo && <Insignia>{tipo}</Insignia>}
        <Insignia>
          {formatearHa(finca.superficie_ha, 4)}
          {finca.superficie_ha !== null && ` · ${formatearM2(finca.superficie_ha)}`}
        </Insignia>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <EnlaceBoton a={`/fincas/${finca.id}`} variante="secundario">
          Ver ficha
        </EnlaceBoton>
        {ubicacion ? <EnlaceLlegar latitud={ubicacion.latitud} longitud={ubicacion.longitud} /> : <span />}
      </div>
    </Tarjeta>
  )
}

/** Recintos SIGPAC consultados: al tocar el mapa, desde mi posición o buscando una parcela. */
export function TarjetaRecintos({ recintos, activo, alElegir, alCerrar }: {
  recintos: RecintoSigpac[]
  activo: number
  alElegir: (indice: number) => void
  alCerrar: () => void
}) {
  const navegar = useNavigate()
  const r = recintos[activo] ?? recintos[0]
  const claveActivo = claveRecinto(r)
  const fincas = useLiveQuery(() => fincasDeRecinto(r), [claveActivo])
  const centroRecinto = centroDe(r.geometria)
  const municipio = nombreMunicipio(r.provincia, r.municipio)

  return (
    <Tarjeta alCerrar={alCerrar} etiquetaCerrar="Cerrar la información del recinto">
      <div className="flex items-start gap-3 pr-10">
        <Silueta geometria={r.geometria} className="size-14" />
        <div className="min-w-0">
          <h2 className="text-lg leading-tight font-bold text-stone-900">{textoReferencia(r)}</h2>
          <p className="truncate text-sm text-stone-500">
            {municipio}
            {r.provincia !== PROVINCIA_ALMERIA && ` (${nombreProvincia(r.provincia)})`}
          </p>
          <p className="truncate text-sm text-stone-600">
            {[r.superficie_ha !== null ? `${formatearHa(r.superficie_ha, 4)} · ${formatearM2(r.superficie_ha)}` : null, nombreUsoSigpac(r.uso_sigpac)]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      {recintos.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto" role="radiogroup" aria-label="Recintos de la parcela">
          {recintos.map((x, i) => (
            <button
              key={x.recinto}
              type="button"
              role="radio"
              aria-checked={i === activo}
              onClick={() => alElegir(i)}
              className={cx(
                'min-h-10 shrink-0 rounded-full px-4 text-sm font-medium ring-1 transition',
                i === activo ? 'bg-cyan-600 text-white ring-cyan-600' : 'bg-white text-stone-700 ring-stone-300 hover:bg-stone-50',
              )}
            >
              Rec. {x.recinto}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-2 text-sm">
        {fincas === undefined ? null : fincas.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-stone-600">
            <TriangleAlert className="size-4 shrink-0 text-amber-600" aria-hidden />
            Este recinto no está en ninguna finca.
          </p>
        ) : (
          fincas.map((f) => (
            <Link
              key={f.fincaId}
              to={`/fincas/${f.fincaId}`}
              className="flex min-h-12 items-center gap-2 rounded-xl bg-marca-50 px-3 text-marca-900 hover:bg-marca-100"
            >
              <Sprout className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">
                <strong>{f.nombre}</strong>
                {f.socio && <span className="text-marca-800"> · {f.socio}</span>}
              </span>
            </Link>
          ))
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {fincas && fincas.length === 0 ? (
          <Boton variante="secundario" icono={Plus} onClick={() => navegar('/fincas/nueva', { state: { recinto: r } })}>
            Crear finca
          </Boton>
        ) : (
          <span />
        )}
        {centroRecinto ? <EnlaceLlegar latitud={centroRecinto[0]} longitud={centroRecinto[1]} /> : <span />}
      </div>
    </Tarjeta>
  )
}
