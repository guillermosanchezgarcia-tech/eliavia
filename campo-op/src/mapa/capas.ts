// Capas del mapa. Todas son servicios públicos y gratuitos del Estado:
//   · Ortofoto PNOA y mapa base: Instituto Geográfico Nacional (IGN), CC BY 4.0.
//   · Recintos: SIGPAC, FEGA (Ministerio de Agricultura).
// Las teselas se piden con CORS (`crossOrigin`) para que el navegador pueda
// guardarlas en la caché sin que ocupen espacio de más y se vean sin conexión.

import L from 'leaflet'
import { urlMapaBase, urlOrtofoto, urlSigpac, ZOOM_NATIVO, type Tesela } from './teselas'
import { buscarTesela } from './zonas'

export const ATRIBUCION =
  '© <a href="https://www.ign.es" target="_blank" rel="noreferrer">IGN</a> (PNOA) · ' +
  '© <a href="https://www.fega.gob.es" target="_blank" rel="noreferrer">FEGA</a> (SIGPAC)'

export type BaseMapa = 'ortofoto' | 'mapa'

export const NOMBRES_BASE: Record<BaseMapa, string> = {
  ortofoto: 'Ortofoto (satélite)',
  mapa: 'Mapa (calles)',
}

export { ZOOM_NATIVO }
export const ZOOM_MAXIMO = 21

/**
 * Capa de teselas que, antes de pedir cada imagen a internet, mira si está en
 * una zona descargada (parte 4). Así el mapa se ve sin cobertura en esas zonas.
 */
class CapaConZonas extends L.TileLayer {
  private readonly hacerUrl: (t: Tesela) => string

  constructor(hacerUrl: (t: Tesela) => string, opciones: L.TileLayerOptions) {
    super('', opciones)
    this.hacerUrl = hacerUrl
  }

  getTileUrl(coords: L.Coords): string {
    return this.hacerUrl({ z: coords.z, x: coords.x, y: coords.y })
  }

  createTile(coords: L.Coords, hecho: L.DoneCallback): HTMLElement {
    const img = document.createElement('img')
    const interna = this as unknown as {
      _tileOnLoad: (hecho: L.DoneCallback, tile: HTMLElement) => void
      _tileOnError: (hecho: L.DoneCallback, tile: HTMLElement, e: Event) => void
    }
    let local: string | null = null
    const soltar = () => {
      if (local) URL.revokeObjectURL(local)
      local = null
    }
    img.addEventListener('load', () => {
      soltar()
      interna._tileOnLoad.call(this, hecho, img)
    })
    img.addEventListener('error', (e) => {
      soltar()
      interna._tileOnError.call(this, hecho, img, e)
    })
    img.crossOrigin = ''
    img.alt = ''
    img.setAttribute('role', 'presentation')
    const url = this.getTileUrl(coords)
    void buscarTesela(url).then((blob) => {
      if (blob) {
        local = URL.createObjectURL(blob)
        img.src = local
      } else {
        img.src = url
      }
    })
    return img
  }
}

export function crearBase(base: BaseMapa): L.TileLayer {
  return new CapaConZonas(base === 'ortofoto' ? urlOrtofoto : urlMapaBase, {
    maxNativeZoom: ZOOM_NATIVO,
    maxZoom: ZOOM_MAXIMO,
    attribution: ATRIBUCION,
    className: 'capa-base',
  })
}

/** Líneas de los recintos SIGPAC (el estilo oficial: magenta). */
export function crearSigpac(): L.TileLayer {
  return new CapaConZonas(urlSigpac, {
    maxNativeZoom: ZOOM_NATIVO,
    maxZoom: ZOOM_MAXIMO,
  })
}

/** Vista por defecto cuando no hay fincas: el Poniente almeriense. */
export const VISTA_INICIAL = { centro: [36.77, -2.81] as [number, number], zoom: 11 }

/** Por debajo de este zoom los contornos son puntitos: se dibuja un punto por finca. */
export const ZOOM_CONTORNOS = 14

/** Por debajo de este zoom no tiene sentido tocar el mapa para consultar un recinto. */
export const ZOOM_CONSULTA = 15
