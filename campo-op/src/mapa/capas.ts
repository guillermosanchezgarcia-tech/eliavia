// Capas del mapa. Todas son servicios públicos y gratuitos del Estado:
//   · Ortofoto PNOA y mapa base: Instituto Geográfico Nacional (IGN), CC BY 4.0.
//   · Recintos: SIGPAC, FEGA (Ministerio de Agricultura).
// Las teselas se piden con CORS (`crossOrigin`) para que el navegador pueda
// guardarlas en la caché sin que ocupen espacio de más y se vean sin conexión.

import L from 'leaflet'

export const ATRIBUCION =
  '© <a href="https://www.ign.es" target="_blank" rel="noreferrer">IGN</a> (PNOA) · ' +
  '© <a href="https://www.fega.gob.es" target="_blank" rel="noreferrer">FEGA</a> (SIGPAC)'

const WMTS = (capa: string, servicio: string) =>
  `https://www.ign.es/wmts/${servicio}?request=GetTile&service=WMTS&VERSION=1.0.0&Layer=${capa}` +
  '&Style=default&Format=image/jpeg&TileMatrixSet=GoogleMapsCompatible&TileMatrix={z}&TileRow={y}&TileCol={x}'

export type BaseMapa = 'ortofoto' | 'mapa'

export const NOMBRES_BASE: Record<BaseMapa, string> = {
  ortofoto: 'Ortofoto (satélite)',
  mapa: 'Mapa (calles)',
}

/** Zoom máximo al que existen teselas (PNOA llega al 19); más allá se amplían. */
export const ZOOM_NATIVO = 19
export const ZOOM_MAXIMO = 21

export function crearBase(base: BaseMapa): L.TileLayer {
  const url = base === 'ortofoto' ? WMTS('OI.OrthoimageCoverage', 'pnoa-ma') : WMTS('IGNBaseTodo', 'ign-base')
  return L.tileLayer(url, {
    maxNativeZoom: ZOOM_NATIVO,
    maxZoom: ZOOM_MAXIMO,
    crossOrigin: true,
    attribution: ATRIBUCION,
    className: 'capa-base',
  })
}

/** Líneas de los recintos SIGPAC (el estilo oficial: magenta). */
export function crearSigpac(): L.TileLayer.WMS {
  return L.tileLayer.wms('https://sigpac-hubcloud.es/wms', {
    layers: 'AU.Sigpac:recinto',
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    maxNativeZoom: ZOOM_NATIVO,
    maxZoom: ZOOM_MAXIMO,
    crossOrigin: true,
  })
}

/** Vista por defecto cuando no hay fincas: el Poniente almeriense. */
export const VISTA_INICIAL = { centro: [36.77, -2.81] as [number, number], zoom: 11 }

/** Por debajo de este zoom los contornos son puntitos: se dibuja un punto por finca. */
export const ZOOM_CONTORNOS = 14

/** Por debajo de este zoom no tiene sentido tocar el mapa para consultar un recinto. */
export const ZOOM_CONSULTA = 15
