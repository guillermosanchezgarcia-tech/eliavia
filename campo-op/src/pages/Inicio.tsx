import { ChevronRight, Crosshair, Map as IconoMapa, Search, Sprout, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { usePerfil } from '../auth/contexto'
import { Cabecera, Contenido } from '../components/Layout'
import { Aviso, Tarjeta } from '../components/ui'
import { config } from '../config'
import { useFincas, useSocios } from '../datos/consultas'
import { useConexion } from '../hooks/useConexion'
import { formatearNumero } from '../lib/formato'

function saludo(hora: number) {
  if (hora < 6) return 'Buenas noches'
  if (hora < 14) return 'Buenos días'
  if (hora < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

export function Inicio() {
  const perfil = usePerfil()
  const conexion = useConexion()
  const [ahora] = useState(() => new Date())
  const fecha = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(ahora)
  const nombre = (perfil.nombre || perfil.email).split(' ')[0]
  const socios = useSocios()
  const fincas = useFincas()
  const totalHa = (fincas ?? []).reduce((suma, f) => suma + (f.superficie_ha ?? 0), 0)

  return (
    <>
      <Cabecera titulo={`${saludo(ahora.getHours())}, ${nombre}`} subtitulo={fecha.charAt(0).toUpperCase() + fecha.slice(1)} />
      <Contenido className="space-y-6">
        {!conexion && (
          <Aviso tipo="aviso" titulo="Estás trabajando sin conexión">
            Puedes seguir usando la app. Los cambios se enviarán solos cuando vuelva la cobertura.
          </Aviso>
        )}

        <section aria-labelledby="titulo-resumen">
          <h2 id="titulo-resumen" className="mb-3 text-sm font-semibold tracking-wide text-stone-500 uppercase">
            Resumen de {config.nombreOP}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <Cifra valor={socios ? formatearNumero(socios.filter((s) => s.estado === 'activo').length) : '—'} texto="Socios activos" />
            <Cifra valor={fincas ? formatearNumero(fincas.length) : '—'} texto="Fincas" />
            <Cifra valor={fincas ? formatearNumero(totalHa, totalHa < 100 ? 1 : 0) : '—'} texto="Hectáreas" />
          </div>
        </section>

        <section aria-labelledby="titulo-accesos">
          <h2 id="titulo-accesos" className="mb-3 text-sm font-semibold tracking-wide text-stone-500 uppercase">
            Accesos rápidos
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Acceso a="/socios" icono={Search} titulo="Buscar un socio" texto="Por nombre, código o NIF" />
            <Acceso a="/fincas" icono={Sprout} titulo="Fincas" texto="Filtrar por cultivo, municipio…" />
            <Acceso a="/mapa" icono={IconoMapa} titulo="Mapa" texto="Ortofoto PNOA y SIGPAC" />
            <Acceso a="/mapa?pos=1" icono={Crosshair} titulo="¿Dónde estoy?" texto="Mi posición y su recinto SIGPAC" />
          </div>
        </section>
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

function Acceso({ a, icono: Icono, titulo, texto }: { a: string; icono: LucideIcon; titulo: string; texto: string }) {
  return (
    <Link
      to={a}
      className="flex min-h-18 items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 transition hover:ring-marca-300 active:scale-[.99]"
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-marca-700 text-white">
        <Icono className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-stone-900">{titulo}</span>
        <span className="block text-sm text-stone-500">{texto}</span>
      </span>
      <ChevronRight className="size-5 text-stone-400" aria-hidden />
    </Link>
  )
}
