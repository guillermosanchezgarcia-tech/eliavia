// Piezas comunes de las pruebas de extremo a extremo: servicios públicos simulados.
//
// El SIGPAC se simula con respuestas reales grabadas (pruebas/fixtures/sigpac) y
// las teselas del mapa con una imagen plana, para que las pruebas no dependan de
// que los servicios del Estado estén disponibles. Con SIGPAC_REAL=1 se usan los
// servicios de verdad.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const fixture = (nombre) => readFileSync(join(AQUI, 'fixtures/sigpac', nombre), 'utf8')
const CORS = { 'access-control-allow-origin': '*' }

/** Consultas del SIGPAC (recinto en un punto, por referencia, por parcela) y su capa WMS. */
export async function simularSigpac(ctx) {
  if (process.env.SIGPAC_REAL) return
  const teselaWms = readFileSync(join(AQUI, 'fixtures/tesela-transparente.png'))
  await ctx.route('https://sigpac-hubcloud.es/**', (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname
    if (p === '/wms') return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'image/png' }, body: teselaWms })
    const vacio = JSON.stringify({ type: 'FeatureCollection', features: [] })
    let cuerpo = vacio
    if (/recinfobypoint\/4326\/-2\.73[0-9]+\/36\.73[0-9]+\.geojson/.test(p)) cuerpo = fixture('punto.json')
    else if (p.endsWith('/recinfo/4/104/0/0/23/372/3.geojson')) cuerpo = fixture('recinto.json')
    else if (p.endsWith('/recinfoparc/4/104/0/0/23/372.geojson')) cuerpo = fixture('parcela.json')
    route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: cuerpo })
  })
}

/** Teselas de la ortofoto PNOA y del mapa base del IGN. Devuelve la lista de direcciones pedidas. */
export async function simularTeselas(ctx) {
  const peticiones = []
  if (process.env.SIGPAC_REAL) return peticiones
  const tesela = readFileSync(join(AQUI, 'fixtures/tesela.png'))
  await ctx.route('https://www.ign.es/wmts/**', (route) => {
    peticiones.push({ url: route.request().url(), modo: route.request().headers()['sec-fetch-mode'] })
    route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'image/png' }, body: tesela })
  })
  return peticiones
}
