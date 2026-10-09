// Ventana para descargar una zona del mapa y verla sin cobertura (parte 4).
// Se usa desde el mapa («lo que veo en pantalla») y desde Más → Mapas sin
// conexión («alrededor de mis fincas»).

import { CloudDownload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useConexion } from '../hooks/useConexion'
import { mensajeDeError } from '../lib/errores'
import { DETALLES, formatearBytes, MAX_TESELAS, planificar, type Area, type Detalle } from '../mapa/teselas'
import { crearZona, espacioDelMovil, useDescarga } from '../mapa/zonas'
import type { ZonaMapa } from '../datos/db'
import { formatearNumero } from '../lib/formato'
import { Aviso, Boton, Campo, Dialogo, Opciones } from './ui'

type Props = {
  abierto: boolean
  alCerrar: () => void
  alEmpezar?: (id: string) => void
  titulo: string
  tipo: ZonaMapa['tipo']
  nombreInicial: string
  /** Qué hay que descargar según el detalle elegido. */
  areasPara: (detalle: number) => Area[]
  explicacion: string
}

export function DialogoDescargarZona(props: Props) {
  // Se monta de nuevo cada vez que se abre, para empezar siempre en limpio.
  return props.abierto ? <Contenido {...props} /> : null
}

function Contenido({ alCerrar, alEmpezar, titulo, tipo, nombreInicial, areasPara, explicacion }: Props) {
  const conexion = useConexion()
  const enCurso = useDescarga()
  const [detalle, setDetalle] = useState<Detalle>('18')
  const [nombre, setNombre] = useState(nombreInicial)
  const [libre, setLibre] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [empezando, setEmpezando] = useState(false)

  useEffect(() => {
    void espacioDelMovil().then((e) => setLibre(e?.disponible ?? null))
  }, [])

  const areas = useMemo(() => areasPara(Number(detalle)), [areasPara, detalle])
  const plan = useMemo(() => planificar(areas), [areas])
  const demasiado = plan.total > MAX_TESELAS
  const sinEspacio = libre !== null && plan.bytesEstimados * 1.2 > libre
  const ayuda = DETALLES.find((d) => d.valor === detalle)?.ayuda

  async function empezar() {
    setEmpezando(true)
    setError(null)
    try {
      const id = await crearZona({ nombre, tipo, areas, detalle: Number(detalle) })
      alEmpezar?.(id)
      alCerrar()
    } catch (e) {
      setError(mensajeDeError(e))
      setEmpezando(false)
    }
  }

  return (
    <Dialogo
      abierto
      titulo={titulo}
      alCerrar={alCerrar}
      acciones={
        <>
          <Boton variante="secundario" onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            icono={CloudDownload}
            cargando={empezando}
            disabled={!conexion || demasiado || plan.total === 0 || Boolean(enCurso) || sinEspacio}
            onClick={() => void empezar()}
          >
            Descargar
          </Boton>
        </>
      }
    >
      <div className="space-y-4">
        <p>{explicacion}</p>
        <Campo etiqueta="Nombre de la zona" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} />
        <div>
          <p className="mb-1.5 text-sm font-medium text-stone-700">Detalle</p>
          <Opciones
            etiqueta="Detalle del mapa"
            valor={detalle}
            onChange={setDetalle}
            opciones={DETALLES.map((d) => ({ valor: d.valor, texto: d.texto }))}
          />
          {ayuda && <p className="mt-1.5 text-sm text-stone-500">{ayuda}</p>}
        </div>

        {demasiado ? (
          <Aviso tipo="error" titulo="La zona es demasiado grande">
            {tipo === 'pantalla'
              ? 'Acerca el mapa para descargar un trozo más pequeño, o elige menos detalle.'
              : 'Hay demasiadas fincas para este detalle. Elige menos detalle.'}
          </Aviso>
        ) : (
          <div className="rounded-xl bg-stone-50 p-3 text-stone-700 ring-1 ring-stone-200">
            <p>
              Ocupará unos <strong>{formatearBytes(plan.bytesEstimados)}</strong> ({formatearNumero(plan.total)} imágenes).
            </p>
            {libre !== null && <p className="text-stone-500">Espacio libre para la app: {formatearBytes(libre)}.</p>}
            <p className="mt-1 text-stone-500">Mejor con wifi. Puedes seguir usando la app mientras se descarga.</p>
          </div>
        )}

        {sinEspacio && !demasiado && (
          <Aviso tipo="error">No hay espacio suficiente en el móvil. Borra alguna zona o elige menos detalle.</Aviso>
        )}
        {!conexion && <Aviso tipo="aviso">Necesitas conexión para descargar el mapa.</Aviso>}
        {enCurso && <Aviso tipo="aviso">Ya se está descargando «{enCurso.nombre}». Espera a que termine.</Aviso>}
        {error && <Aviso tipo="error">{error}</Aviso>}
      </div>
    </Dialogo>
  )
}
