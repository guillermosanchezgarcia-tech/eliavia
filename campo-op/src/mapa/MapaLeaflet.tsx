import type { Geometry } from 'geojson'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { latLngsDe } from '../lib/geometria'
import { crearBase, crearSigpac, VISTA_INICIAL, ZOOM_CONTORNOS, ZOOM_MAXIMO, type BaseMapa } from './capas'
import type { FincaMapa, Limites } from './datos'

export interface Ajuste {
  /** Cambia cada vez que se quiere mover el mapa (aunque el destino sea el mismo). */
  clave: number
  limites?: Limites | null
  centro?: [number, number]
  zoom?: number
  /** 1 = acercar, -1 = alejar. */
  delta?: 1 | -1
}

export interface Resaltado {
  geometria: Geometry | null
  activo: boolean
}

export interface PosicionMapa {
  latitud: number
  longitud: number
  precision: number
}

interface Props {
  fincas: FincaMapa[]
  fincaActiva: string | null
  resaltados: Resaltado[]
  posicion: PosicionMapa | null
  base: BaseMapa
  verSigpac: boolean
  verFincas: boolean
  ajuste: Ajuste | null
  /** Vista con la que abrir el mapa (la última que se usó). Si no hay, se ajusta a `limitesIniciales`. */
  vistaInicial: { centro: [number, number]; zoom: number } | null
  /** Se encuadra una sola vez, cuando hay datos, si no había `vistaInicial`. */
  limitesIniciales: Limites | null
  alElegirFinca: (id: string) => void
  alTocar: (latitud: number, longitud: number, zoom: number) => void
  alMoverVista: (centro: [number, number], zoom: number) => void
  className?: string
}

// Amarillo sobre la ortofoto se distingue mejor que el verde, y no se confunde
// con el magenta de las líneas del SIGPAC.
const ESTILO_FINCA: L.PathOptions = { color: '#fde047', weight: 2, fillColor: '#fde047', fillOpacity: 0.18 }
const ESTILO_ACTIVA: L.PathOptions = { color: '#f97316', weight: 4, fillColor: '#f97316', fillOpacity: 0.35 }
const ESTILO_RESALTADO: L.PathOptions = { color: '#22d3ee', weight: 3, fillColor: '#22d3ee', fillOpacity: 0.2 }
const ESTILO_RESALTADO_ACTIVO: L.PathOptions = { color: '#06b6d4', weight: 5, fillColor: '#22d3ee', fillOpacity: 0.4 }

interface CapasFinca {
  contornos: L.Path[]
  marcas: L.CircleMarker[]
}

/** Mapa de Leaflet envuelto para React. Dibuja lo que le dan; no consulta datos. */
export function MapaLeaflet(props: Props) {
  const { fincas, fincaActiva, resaltados, posicion, base, verSigpac, verFincas, ajuste, limitesIniciales, className } = props

  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const lienzo = useRef<L.Canvas | null>(null)
  const capaBase = useRef<L.TileLayer | null>(null)
  const capaSigpac = useRef<L.TileLayer.WMS | null>(null)
  const grupoContornos = useRef<L.LayerGroup>(L.layerGroup())
  const grupoLejos = useRef<L.LayerGroup>(L.layerGroup())
  const grupoMarcas = useRef<L.LayerGroup>(L.layerGroup())
  const grupoResaltados = useRef<L.LayerGroup>(L.layerGroup())
  const grupoPosicion = useRef<L.LayerGroup>(L.layerGroup())
  const porFinca = useRef(new Map<string, CapasFinca>())
  const activaAnterior = useRef<string | null>(null)
  const verFincasRef = useRef(verFincas)
  const yaEncuadrado = useRef(false)

  // Las funciones de los padres cambian en cada pintado: se leen siempre las últimas.
  const llamadas = useRef(props)
  useEffect(() => {
    llamadas.current = props
  })

  // ---- Crear y destruir el mapa ------------------------------------------------
  useEffect(() => {
    const el = contenedor.current
    if (!el) return
    const inicial = llamadas.current.vistaInicial ?? VISTA_INICIAL
    const m = L.map(el, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
      maxZoom: ZOOM_MAXIMO,
      center: inicial.centro,
      zoom: inicial.zoom,
      zoomSnap: 0.5,
    })
    mapa.current = m
    yaEncuadrado.current = llamadas.current.vistaInicial !== null
    lienzo.current = L.canvas({ padding: 0.5, tolerance: 10 })
    L.control.attribution({ prefix: false, position: 'bottomleft' }).addTo(m)

    // Contornos por debajo de las marcas, y todo por encima del SIGPAC.
    for (const g of [grupoContornos, grupoLejos, grupoMarcas, grupoResaltados, grupoPosicion]) g.current.addTo(m)

    const alternarModo = () => {
      const cerca = m.getZoom() >= ZOOM_CONTORNOS
      const ver = verFincasRef.current
      const poner = (g: L.LayerGroup, visible: boolean) => {
        if (visible && !m.hasLayer(g)) g.addTo(m)
        if (!visible && m.hasLayer(g)) m.removeLayer(g)
      }
      poner(grupoContornos.current, ver && cerca)
      poner(grupoLejos.current, ver && !cerca)
      poner(grupoMarcas.current, ver)
    }
    m.on('zoomend', alternarModo)
    ;(m as L.Map & { _alternarModo?: () => void })._alternarModo = alternarModo

    m.on('click', (e) => llamadas.current.alTocar(e.latlng.lat, e.latlng.lng, m.getZoom()))
    m.on('moveend', () => {
      const c = m.getCenter()
      llamadas.current.alMoverVista([c.lat, c.lng], m.getZoom())
    })

    // El mapa necesita avisar cuando cambia el tamaño de su caja (girar el móvil, etc.).
    const observador = new ResizeObserver(() => m.invalidateSize())
    observador.observe(el)

    const fincasDibujadas = porFinca.current
    const contornos = grupoContornos.current
    const lejos = grupoLejos.current
    const marcas = grupoMarcas.current
    const resaltadosGrupo = grupoResaltados.current
    const posicionGrupo = grupoPosicion.current
    return () => {
      observador.disconnect()
      m.off()
      // Si se sale mientras anima un zoom, Leaflet termina la animación 250 ms después sobre un mapa
      // ya destruido y falla. Se espera a que acabe antes de quitarlo.
      const animandoZoom = (m as L.Map & { _animatingZoom?: boolean })._animatingZoom
      if (animandoZoom) setTimeout(() => m.remove(), 400)
      else m.remove()
      mapa.current = null
      yaEncuadrado.current = false
      capaBase.current = null
      capaSigpac.current = null
      fincasDibujadas.clear()
      for (const g of [contornos, lejos, marcas, resaltadosGrupo, posicionGrupo]) g.clearLayers()
    }
  }, [])

  // ---- Capas de fondo -----------------------------------------------------------
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    capaBase.current?.remove()
    const nueva = crearBase(base)
    nueva.addTo(m)
    nueva.bringToBack()
    capaBase.current = nueva
  }, [base])

  useEffect(() => {
    const m = mapa.current
    if (!m) return
    if (verSigpac && !capaSigpac.current) {
      capaSigpac.current = crearSigpac().addTo(m)
    } else if (!verSigpac && capaSigpac.current) {
      capaSigpac.current.remove()
      capaSigpac.current = null
    }
  }, [verSigpac])

  // ---- Fincas -------------------------------------------------------------------
  useEffect(() => {
    const m = mapa.current as (L.Map & { _alternarModo?: () => void }) | null
    if (!m || !lienzo.current) return
    verFincasRef.current = verFincas
    grupoContornos.current.clearLayers()
    grupoLejos.current.clearLayers()
    grupoMarcas.current.clearLayers()
    porFinca.current.clear()

    const elegir = (id: string) => () => llamadas.current.alElegirFinca(id)
    const comun = { renderer: lienzo.current, bubblingMouseEvents: false }
    for (const f of fincas) {
      const capas: CapasFinca = { contornos: [], marcas: [] }
      for (const c of f.contornos) {
        const puntos = latLngsDe(c)
        if (!puntos) continue
        const poligono = L.polygon(puntos, { ...ESTILO_FINCA, ...comun })
        poligono.on('click', elegir(f.id))
        grupoContornos.current.addLayer(poligono)
        capas.contornos.push(poligono)
      }
      if (f.punto) {
        const marca = L.circleMarker(f.punto, { ...ESTILO_FINCA, fillOpacity: 0.7, radius: 7, ...comun })
        marca.on('click', elegir(f.id))
        // Con contorno, el punto solo se ve de lejos; sin él, se ve siempre.
        ;(f.contornos.length ? grupoLejos.current : grupoMarcas.current).addLayer(marca)
        capas.marcas.push(marca)
      }
      porFinca.current.set(f.id, capas)
    }
    activaAnterior.current = null
    m._alternarModo?.()
  }, [fincas, verFincas])

  // ---- Finca elegida ------------------------------------------------------------
  useEffect(() => {
    const aplicar = (id: string | null, activa: boolean) => {
      const capas = id ? porFinca.current.get(id) : undefined
      if (!capas) return
      for (const c of capas.contornos) {
        c.setStyle(activa ? ESTILO_ACTIVA : ESTILO_FINCA)
        if (activa) c.bringToFront()
      }
      for (const c of capas.marcas) {
        c.setStyle(activa ? { ...ESTILO_ACTIVA, fillOpacity: 0.9 } : { ...ESTILO_FINCA, fillOpacity: 0.7 })
        c.setRadius(activa ? 11 : 7)
        if (activa) c.bringToFront()
      }
    }
    aplicar(activaAnterior.current, false)
    aplicar(fincaActiva, true)
    activaAnterior.current = fincaActiva
  }, [fincaActiva, fincas, verFincas])

  // ---- Recintos consultados ------------------------------------------------------
  useEffect(() => {
    const grupo = grupoResaltados.current
    grupo.clearLayers()
    if (!lienzo.current) return
    for (const r of resaltados) {
      const puntos = latLngsDe(r.geometria)
      if (!puntos) continue
      grupo.addLayer(
        L.polygon(puntos, { ...(r.activo ? ESTILO_RESALTADO_ACTIVO : ESTILO_RESALTADO), renderer: lienzo.current, interactive: false }),
      )
    }
  }, [resaltados])

  // ---- Mi posición --------------------------------------------------------------
  useEffect(() => {
    const grupo = grupoPosicion.current
    grupo.clearLayers()
    if (!posicion || !lienzo.current) return
    const centroPosicion: L.LatLngTuple = [posicion.latitud, posicion.longitud]
    grupo.addLayer(
      L.circle(centroPosicion, {
        radius: posicion.precision,
        color: '#2563eb',
        weight: 1,
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
        renderer: lienzo.current,
        interactive: false,
      }),
    )
    grupo.addLayer(
      L.circleMarker(centroPosicion, {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: '#2563eb',
        fillOpacity: 1,
        renderer: lienzo.current,
        interactive: false,
      }),
    )
  }, [posicion])

  // ---- Encuadre inicial ----------------------------------------------------------
  useEffect(() => {
    const m = mapa.current
    if (!m || yaEncuadrado.current || !limitesIniciales) return
    yaEncuadrado.current = true
    // Si ya hay una finca elegida (se abrió desde su ficha), se deja hueco abajo para su tarjeta.
    const abajo = llamadas.current.fincaActiva ? 210 : 30
    m.fitBounds(limitesIniciales, { paddingTopLeft: [30, 90], paddingBottomRight: [30, abajo], maxZoom: 17 })
  }, [limitesIniciales])

  // ---- Mover el mapa ------------------------------------------------------------
  useEffect(() => {
    const m = mapa.current
    if (!m || !ajuste) return
    if (ajuste.delta) {
      if (ajuste.delta > 0) m.zoomIn()
      else m.zoomOut()
    } else if (ajuste.limites) {
      m.fitBounds(ajuste.limites, { paddingTopLeft: [30, 90], paddingBottomRight: [30, 210], maxZoom: 18 })
    } else if (ajuste.centro) {
      m.setView(ajuste.centro, ajuste.zoom ?? 17)
    }
  }, [ajuste])

  return <div ref={contenedor} className={className} role="application" aria-label="Mapa de fincas" />
}
