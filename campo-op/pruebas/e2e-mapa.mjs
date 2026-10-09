// Prueba de extremo a extremo del mapa (parte 5) contra un Supabase local real:
// capas (ortofoto PNOA, mapa base, SIGPAC), fincas dibujadas y elegibles,
// consulta de recintos al tocar, mi posición, buscar parcela, crear una finca
// desde un recinto, filtros y trabajo sin conexión.
//
// Las teselas y el SIGPAC se simulan (pruebas/ayudas.mjs). Con SIGPAC_REAL=1 se
// usan los servicios públicos de verdad.
//
// Cómo ejecutarla: ver pruebas/README.md.
//   node pruebas/e2e-mapa.mjs [carpeta-para-capturas]

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { simularSigpac, simularTeselas } from './ayudas.mjs'

const { chromium, devices } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')

const AQUI = dirname(fileURLToPath(import.meta.url))
const BASE = process.env.APP_URL ?? 'http://localhost:4173'
const DB = process.env.DB_CONTAINER ?? 'supabase_db_campo-op'
const OUT = process.argv[2] ?? 'pruebas/capturas'
const CLAVE = 'clave-segura-1'
mkdirSync(OUT, { recursive: true })

function sql(consulta) {
  return execFileSync('docker', ['exec', '-i', DB, 'psql', '-U', 'postgres', '-d', 'postgres', '-tA', '-c', consulta], {
    encoding: 'utf8',
  }).trim()
}

let fallos = 0
function comprobar(nombre, ok, detalle = '') {
  if (!ok) fallos++
  console.log(`${ok ? '✔' : '✘'} ${nombre}${detalle ? ` (${detalle})` : ''}`)
}
async function esperarQue(nombre, fn, ms = 20000) {
  const fin = Date.now() + ms
  let ultimo
  while (Date.now() < fin) {
    ultimo = await fn()
    if (ultimo === true) return comprobar(nombre, true)
    await new Promise((r) => setTimeout(r, 300))
  }
  comprobar(nombre, false, `último valor: ${JSON.stringify(ultimo)}`)
}

// ---------- Datos de partida: los recintos reales de la parcela 23/372 de El Ejido ----------
const parcela = JSON.parse(readFileSync(join(AQUI, 'fixtures/sigpac/parcela.json'), 'utf8'))
const esc = (v) => String(v).replace(/'/g, "''")
sql(`insert into socios (codigo, nombre, localidad) values ('0001','Agrícola Pérez SL','El Ejido'), ('0002','Hortalizas Níjar SAT','Níjar')`)
const idPerez = sql("select id from socios where codigo='0001'")
const idNijar = sql("select id from socios where codigo='0002'")
const nuevaFinca = (socio, nombre, municipio, tipo, ha, cultivo, extra = '') =>
  sql(`insert into fincas (socio_id,nombre,provincia,municipio,tipo,superficie_ha,cultivo,campana ${extra ? ',' + extra.split('=')[0] : ''})
       values ('${socio}','${nombre}',4,${municipio},'${tipo}',${ha},'${cultivo}','2026/2027' ${extra ? ',' + extra.split('=')[1] : ''}) returning id`).split('\n')[0]
const idLoma = nuevaFinca(idPerez, 'La Loma', 104, 'invernadero', 3.4527, 'Tomate')
const idBalsa = nuevaFinca(idPerez, 'Balsa Nueva', 104, 'invernadero', 0.2734, 'Pepino')
sql(`insert into fincas (socio_id,nombre,provincia,municipio,tipo,superficie_ha,cultivo,campana,latitud,longitud)
  values ('${idNijar}','El Cerro Alto',4,66,'aire_libre',5,'Pimiento','2026/2027',36.9,-2.2)`)
const idSinUbicacion = nuevaFinca(idPerez, 'Sin Ubicación', 104, 'aire_libre', 1, 'Calabacín')
for (const f of parcela.features) {
  const p = f.properties
  const dueno = p.recinto === 3 ? idLoma : p.recinto === 2 ? idBalsa : null
  if (!dueno) continue
  sql(`insert into recintos (finca_id,provincia,municipio,agregado,zona,poligono,parcela,recinto,superficie_ha,uso_sigpac,geometria)
       values ('${dueno}',4,104,0,0,${p.poligono},${p.parcela},${p.recinto},${p.superficie},'${esc(p.uso_sigpac)}','${esc(JSON.stringify(f.geometry))}'::jsonb)`)
}

const errores = []
const browser = await chromium.launch()

async function nuevoContexto(opciones = {}) {
  const ctx = await browser.newContext({
    ...devices['Pixel 7'],
    locale: 'es-ES',
    serviceWorkers: 'block',
    permissions: ['geolocation'],
    geolocation: { latitude: 36.738, longitude: -2.7366, accuracy: 8 },
    ...opciones,
  })
  await simularSigpac(ctx)
  const teselas = await simularTeselas(ctx)
  const page = await ctx.newPage()
  const wms = []
  page.on('request', (r) => r.url().includes('sigpac-hubcloud.es/wms') && wms.push(r.url()))
  page.on('pageerror', (e) => errores.push('pageerror: ' + e.message + '\n' + (e.stack ?? '').split('\n').slice(0, 6).join('\n')))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push('console: ' + m.text())
  })
  return { ctx, page, teselas, wms }
}

async function entrar(page, email) {
  await page.goto(BASE + '/login')
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', CLAVE)
  await page.click('button[type=submit]')
  await page.getByText('Accesos rápidos').waitFor()
  // El mapa dibuja lo que hay en el móvil: se espera a que se haya descargado todo.
  await page.goto(BASE + '/mas/sincronizacion')
  await page.getByRole('button', { name: 'Sincronizar ahora' }).click()
  await page.getByText('Todo al día').waitFor()
}

async function abrirMapa(page, ruta = '/mapa') {
  await page.goto(BASE + ruta)
  await page.locator('.leaflet-container').waitFor()
  await page.locator('img.leaflet-tile-loaded').first().waitFor()
  await page.waitForTimeout(1200) // fin de la animación de encuadre
}

/** Punto (en pantalla) donde queda el centro de lo que se encuadra: el mapa deja sitio arriba y abajo. */
async function centroEncuadre(page) {
  const caja = await page.locator('.leaflet-container').boundingBox()
  return { x: caja.x + caja.width / 2, y: caja.y + (caja.height + 90 - 210) / 2, caja }
}

// ===================== ADMINISTRADOR EN EL MÓVIL =====================
const { page: a, teselas, wms } = await nuevoContexto()
await entrar(a, 'admin@op.es')

// --- Capas ---
const esperaWms = a.waitForRequest((r) => r.url().includes('sigpac-hubcloud.es/wms'))
await abrirMapa(a)
await esperaWms
comprobar('se piden teselas de la ortofoto PNOA', teselas.some((t) => t.url.includes('/pnoa-ma?') && t.url.includes('OI.OrthoimageCoverage')))
comprobar('y la capa de recintos SIGPAC', wms.some((u) => u.includes('AU.Sigpac%3Arecinto') || u.includes('AU.Sigpac:recinto')))
const sinCors = await a.locator('img.leaflet-tile').evaluateAll((imgs) => imgs.filter((i) => i.crossOrigin !== 'anonymous').length)
comprobar('las teselas se piden con CORS (para poder guardarlas sin conexión)', sinCors === 0 && (await a.locator('img.leaflet-tile').count()) > 0, `${sinCors} sin CORS`)
await a.screenshot({ path: `${OUT}/p01-general.png` })

await a.getByRole('button', { name: 'Capas del mapa' }).click()
await a.getByText(/En el mapa:/).waitFor()
const resumen = await a.getByText(/En el mapa:/).innerText()
comprobar('el panel dice cuántas fincas se ven y cuántas no tienen ubicación', /3 de 4 fincas\. Una no tiene ubicación/.test(resumen), resumen)
comprobar('y muestra la atribución de los datos', (await a.getByText(/Instituto Geográfico Nacional \(PNOA\)/).count()) === 1)
await a.getByRole('button', { name: 'Capas del mapa' }).click()

// A este zoom (vista de toda la zona) no se consulta el SIGPAC al tocar
const cajaGeneral = await a.locator('.leaflet-container').boundingBox()
await a.mouse.click(cajaGeneral.x + cajaGeneral.width / 2, cajaGeneral.y + cajaGeneral.height * 0.7)
await a.getByText('Acerca el mapa para tocar un recinto').waitFor()
comprobar('de lejos avisa de que hay que acercar el mapa', true)

// --- Una finca ---
await abrirMapa(a, `/mapa?finca=${idLoma}`)
await a.getByRole('heading', { name: 'La Loma' }).waitFor()
const llegar = await a.getByRole('link', { name: 'Cómo llegar' }).getAttribute('href')
comprobar('«Cómo llegar» abre Google Maps con el centro del recinto', /google\.com\/maps\/dir\/\?api=1&destination=36\.73\d+,-2\.73\d+/.test(llegar ?? ''), llegar ?? '')
comprobar('la tarjeta muestra socio, cultivo y superficie', (await a.getByText('Agrícola Pérez SL · El Ejido').count()) === 1 && (await a.getByText('Tomate').count()) >= 1 && (await a.getByText(/3,4527 ha/).count()) >= 1)
await a.screenshot({ path: `${OUT}/p02-finca.png` })

// Tocar el contorno de otra finca la elige
await abrirMapa(a, `/mapa?finca=${idBalsa}`)
await a.getByRole('heading', { name: 'Balsa Nueva' }).waitFor()
await a.getByRole('button', { name: 'Cerrar la ficha de la finca' }).click()
comprobar('se puede cerrar la tarjeta', (await a.getByRole('heading', { name: 'Balsa Nueva' }).count()) === 0)
const c = await centroEncuadre(a)
await a.mouse.click(c.x, c.y)
await a.getByRole('heading', { name: 'Balsa Nueva' }).waitFor()
comprobar('al tocar el contorno de una finca se abre su tarjeta', true)
await a.getByRole('link', { name: 'Ver ficha' }).click()
await a.waitForURL(new RegExp(`/fincas/${idBalsa}$`))
comprobar('«Ver ficha» lleva a la finca', true)

// --- Tocar un recinto cualquiera: consulta el SIGPAC ---
await abrirMapa(a, `/mapa?finca=${idLoma}`)
const cajaLoma = await a.locator('.leaflet-container').boundingBox()
await a.mouse.click(cajaLoma.x + cajaLoma.width - 40, cajaLoma.y + cajaLoma.height * 0.3)
await a.getByRole('heading', { name: 'Pol. 23 · Parc. 372 · Rec. 3' }).waitFor()
comprobar('tocar el mapa consulta el recinto SIGPAC', true)
await esperarQue('y dice a qué finca pertenece', async () => (await a.getByRole('link', { name: /La Loma/ }).count()) === 1, 5000)
await a.getByRole('link', { name: /La Loma · Agrícola Pérez SL/ }).click()
await a.waitForURL(new RegExp(`/fincas/${idLoma}$`))
comprobar('la tarjeta enlaza con la finca', true)

// --- Mi posición ---
await abrirMapa(a, '/mapa')
await a.getByRole('button', { name: 'Mi posición' }).click()
await a.getByRole('heading', { name: 'Pol. 23 · Parc. 372 · Rec. 3' }).waitFor()
comprobar('«Mi posición» da el recinto SIGPAC en el que estás', true)
comprobar('«Mi posición» indica la finca a la que pertenece', (await a.getByText('La Loma · Agrícola Pérez SL').count()) === 1)
await a.screenshot({ path: `${OUT}/p03-mi-posicion.png` })

// «¿Dónde estoy?» del inicio abre el mapa y localiza solo
await a.goto(BASE + '/')
await a.getByRole('link', { name: /¿Dónde estoy\?/ }).click()
await a.waitForURL(/\/mapa\?pos=1$/)
await a.getByRole('heading', { name: 'Pol. 23 · Parc. 372 · Rec. 3' }).waitFor()
comprobar('«¿Dónde estoy?» del inicio localiza al abrir el mapa', true)

// --- Buscar parcela y crear una finca desde un recinto ---
await abrirMapa(a, '/mapa')
await a.getByRole('button', { name: /Buscar parcela/ }).click()
await a.getByRole('dialog').getByLabel('Municipio').selectOption({ label: 'El Ejido' })
await a.getByRole('dialog').getByLabel('Polígono').fill('23')
await a.getByRole('dialog').getByLabel('Parcela').fill('372')
await a.getByRole('dialog').getByRole('button', { name: 'Buscar' }).click()
await a.getByText('La parcela tiene 3 recintos').waitFor()
comprobar('al buscar una parcela vienen marcados todos sus recintos', (await a.getByRole('dialog').getByRole('checkbox', { checked: true }).count()) === 3)
await a.getByRole('dialog').getByRole('button', { name: /Ver en el mapa/ }).click()
await a.getByRole('radio', { name: 'Rec. 3' }).waitFor()
comprobar('la tarjeta ofrece los 3 recintos de la parcela', (await a.getByRole('radio', { name: /^Rec\./ }).count()) === 3)
await a.screenshot({ path: `${OUT}/p04-buscar-parcela.png` })
await a.getByRole('radio', { name: 'Rec. 3' }).click()
await a.getByText('La Loma · Agrícola Pérez SL').waitFor()
comprobar('cada recinto indica su finca', true)
await a.getByRole('radio', { name: 'Rec. 1' }).click()
await a.getByText('Este recinto no está en ninguna finca.').waitFor()
await a.getByRole('button', { name: 'Crear finca' }).click()
await a.waitForURL(/\/fincas\/nueva$/)
await a.getByText('Pol. 23 · Parc. 372 · Rec. 1').waitFor()
comprobar('«Crear finca» trae el recinto ya añadido', true)
await esperarQue('con su superficie y municipio', async () =>
  (await a.getByLabel('Superficie (ha)').inputValue()) === '0,389' && (await a.getByLabel('Municipio').first().inputValue()) === '104',
)
await a.getByRole('button', { name: /Elegir socio/ }).click()
await a.getByRole('dialog').getByLabel('Buscar socio').fill('perez')
await a.getByRole('dialog').getByRole('button', { name: /Agrícola Pérez SL/ }).click()
await a.getByLabel('Nombre o código de la finca *').fill('Rincón del camino')
await a.getByRole('button', { name: 'Crear finca' }).click()
await a.waitForURL(/\/fincas\/[0-9a-f-]{36}$/)
const idRincon = a.url().split('/').pop()
await esperarQue('la finca creada desde el mapa llega a Supabase con su recinto', () =>
  sql(`select count(*) from fincas f join recintos r on r.finca_id=f.id where f.id='${idRincon}' and r.recinto=1 and r.uso_sigpac='IM' and f.superficie_ha=0.389`) === '1',
)
await a.getByRole('link', { name: 'Ver en el mapa' }).click()
await a.waitForURL(new RegExp(`/mapa\\?finca=${idRincon}$`))
await a.getByRole('heading', { name: 'Rincón del camino' }).waitFor()
comprobar('la finca nueva se ve en el mapa', true)

// --- Capas: cambiar el fondo y ocultar el SIGPAC; se recuerdan ---
await a.getByRole('button', { name: 'Capas del mapa' }).click()
const numeroAntes = teselas.length
await a.getByRole('radio', { name: 'Mapa (calles)' }).click()
await esperarQue('al elegir «Mapa (calles)» se piden teselas de ign-base', () => teselas.slice(numeroAntes).some((t) => t.url.includes('/ign-base?')))
await a.getByRole('checkbox', { name: 'Recintos SIGPAC' }).click()
await esperarQue('al ocultar el SIGPAC desaparece su capa', async () => (await a.locator('img.leaflet-tile[src*="sigpac-hubcloud"]').count()) === 0)
await a.screenshot({ path: `${OUT}/p05-capas.png` })
teselas.length = 0
await abrirMapa(a, '/mapa')
comprobar('las capas elegidas se recuerdan al volver', teselas.length > 0 && teselas.every((t) => t.url.includes('/ign-base?')))
await a.getByRole('button', { name: 'Capas del mapa' }).click()
await a.getByRole('radio', { name: 'Ortofoto (satélite)' }).click()
await a.getByRole('checkbox', { name: 'Recintos SIGPAC' }).click()
await a.getByRole('button', { name: 'Capas del mapa' }).click()

// --- Filtros que vienen de otras pantallas ---
await abrirMapa(a, '/mapa?cultivo=Pimiento')
await a.getByText(/Filtro activo:/).waitFor()
const pastilla = await a.getByText(/Filtro activo:/).innerText()
comprobar('el filtro del listado se aplica en el mapa', /1 de 5 fincas/.test(pastilla), pastilla)
await a.getByRole('button', { name: 'Quitar' }).click()
await a.getByText(/Filtro activo:/).waitFor({ state: 'detached' })
comprobar('«Quitar» deja el mapa sin filtros', !a.url().includes('cultivo'))

await a.goto(BASE + '/fincas?cultivo=Tomate')
await a.getByText('La Loma').waitFor()
await a.getByRole('link', { name: 'Mapa' }).first().click()
await a.waitForURL(/\/mapa\?cultivo=Tomate$/)
comprobar('el botón «Mapa» del listado lleva los filtros', true)

await a.goto(BASE + `/socios/${idPerez}`)
await a.getByRole('link', { name: 'Ver en el mapa' }).click()
await a.waitForURL(new RegExp(`/mapa\\?socio=${idPerez}$`))
comprobar('la ficha del socio abre el mapa con sus fincas', true)

await a.goto(BASE + `/fincas/${idSinUbicacion}`)
await a.getByText('Sin ubicación: añade un punto GPS o un recinto SIGPAC.').waitFor()
comprobar('una finca sin ubicación no ofrece «Ver en el mapa»', (await a.getByRole('link', { name: 'Ver en el mapa' }).count()) === 0)

// --- Móvil estrecho: nada se sale de la pantalla ---
await a.setViewportSize({ width: 320, height: 640 })
await abrirMapa(a, '/mapa')
await a.getByRole('button', { name: 'Capas del mapa' }).click()
const anchoPagina = await a.evaluate(() => document.documentElement.scrollWidth)
const botonCapas = await a.getByRole('button', { name: 'Capas del mapa' }).boundingBox()
const botonPosicion = await a.getByRole('button', { name: 'Mi posición' }).boundingBox()
comprobar('a 320 px no hay desbordamiento horizontal', anchoPagina <= 320, `${anchoPagina}px`)
comprobar('y los botones del mapa caben en la pantalla', botonCapas.x + botonCapas.width <= 320 && botonPosicion.x + botonPosicion.width <= 320)
await a.screenshot({ path: `${OUT}/p06-320.png` })
await a.setViewportSize({ width: 412, height: 839 })

// ===================== SIN PERMISO DE UBICACIÓN =====================
const { page: s } = await nuevoContexto({ permissions: [] })
await entrar(s, 'admin@op.es')
await abrirMapa(s, '/mapa')
await s.getByRole('button', { name: 'Mi posición' }).click()
await s.getByText(/No has dado permiso para usar la ubicación/).waitFor()
comprobar('sin permiso de ubicación se explica qué hacer', true)

// ===================== TÉCNICO, SIN CONEXIÓN =====================
const { ctx: ctxT, page: t } = await nuevoContexto()
await entrar(t, 'tecnico@op.es')
await abrirMapa(t, `/mapa?finca=${idBalsa}`)
await t.getByRole('heading', { name: 'Balsa Nueva' }).waitFor()
comprobar('el técnico usa el mapa igual que el administrador', true)
await ctxT.setOffline(true)
await t.getByText(/Sin conexión: el mapa se ve en las zonas descargadas/).waitFor()
comprobar('sin conexión avisa de que el fondo puede faltar', true)
await t.getByRole('button', { name: 'Cerrar la ficha de la finca' }).click()
const ct = await centroEncuadre(t)
await t.mouse.click(ct.x, ct.y)
await t.getByRole('heading', { name: 'Balsa Nueva' }).waitFor()
comprobar('sin conexión las fincas se siguen pudiendo elegir', true)
const cajaT = await t.locator('.leaflet-container').boundingBox()
await t.mouse.click(cajaT.x + cajaT.width - 30, cajaT.y + cajaT.height * 0.3)
await t.getByText('Sin conexión: el SIGPAC solo se puede consultar con cobertura.').waitFor()
comprobar('sin conexión el SIGPAC no se consulta y se explica por qué', true)
await t.screenshot({ path: `${OUT}/p07-sin-conexion.png` })
await ctxT.setOffline(false)

// ===================== ORDENADOR =====================
const { page: q, teselas: teselasQ } = await nuevoContexto({ viewport: { width: 1280, height: 860 }, isMobile: false, hasTouch: false, userAgent: undefined })
await entrar(q, 'admin@op.es')
await abrirMapa(q, `/mapa?finca=${idLoma}`)
const zoomDe = (lista) => Math.max(...lista.map((x) => Number(new URL(x.url).searchParams.get('TileMatrix'))).filter((n) => !Number.isNaN(n)))
const zoomAntes = zoomDe(teselasQ)
await q.getByRole('button', { name: 'Acercar' }).click()
await esperarQue('el botón «Acercar» del ordenador aumenta el zoom', () => zoomDe(teselasQ) > zoomAntes)
await q.screenshot({ path: `${OUT}/p08-ordenador.png` })

// Salir del mapa justo mientras anima un zoom no debe dar errores (fallo conocido de Leaflet, ya evitado).
await q.goto(BASE + '/')
const erroresAntes = errores.length
for (let i = 0; i < 24; i++) {
  await q.getByRole('link', { name: 'Mapa' }).first().click()
  await q.locator('.leaflet-container').waitFor()
  await q.waitForTimeout((i * 97) % 450)
  await q.getByRole('button', { name: i % 2 ? 'Alejar' : 'Acercar' }).click()
  await q.waitForTimeout((i * 53) % 260)
  await q.getByRole('link', { name: 'Fincas' }).first().click()
  await q.waitForTimeout((i * 71) % 300)
}
await q.waitForTimeout(1000)
comprobar('abrir y cerrar el mapa deprisa, durante los zooms, no da errores', errores.length === erroresAntes, `${errores.length - erroresAntes} errores`)

await browser.close()
console.log(errores.length ? '\nERRORES DE NAVEGADOR:\n' + errores.join('\n') : '\nSin errores de navegador')
console.log(fallos ? `\n${fallos} COMPROBACIONES FALLIDAS` : '\nTodas las comprobaciones correctas')
process.exit(fallos || errores.length ? 1 : 0)
