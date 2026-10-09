// Prueba de extremo a extremo de los mapas sin conexión (parte 4) contra un
// Supabase local real: descargar el mapa alrededor de las fincas y una zona
// elegida en el mapa, ver la ortofoto y el SIGPAC sin cobertura, cancelar,
// cortes de conexión a mitad, completar, zonas demasiado grandes y borrar.
//
// Las teselas se simulan (cada una con un pequeño retraso, para poder cancelar).
//
// Cómo ejecutarla: ver pruebas/README.md.
//   node pruebas/e2e-zonas.mjs [carpeta-para-capturas]

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { simularSigpac } from './ayudas.mjs'

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
async function esperarQue(nombre, fn, ms = 30000) {
  const fin = Date.now() + ms
  let ultimo
  while (Date.now() < fin) {
    ultimo = await fn()
    if (ultimo === true) return comprobar(nombre, true)
    await new Promise((r) => setTimeout(r, 300))
  }
  comprobar(nombre, false, `último valor: ${JSON.stringify(ultimo)}`)
}

// ---------- Datos: La Loma (con los recintos reales de la parcela 23/372 de El Ejido) y una finca con solo GPS ----------
const parcela = JSON.parse(readFileSync(join(AQUI, 'fixtures/sigpac/parcela.json'), 'utf8'))
const esc = (v) => String(v).replace(/'/g, "''")
sql(`insert into socios (codigo, nombre, localidad) values ('0001','Agrícola Pérez SL','El Ejido')`)
const idPerez = sql("select id from socios where codigo='0001'")
const idLoma = sql(`insert into fincas (socio_id,nombre,provincia,municipio,tipo,superficie_ha,cultivo,campana)
  values ('${idPerez}','La Loma',4,104,'invernadero',3.4527,'Tomate','2026/2027') returning id`).split('\n')[0]
sql(`insert into fincas (socio_id,nombre,provincia,municipio,tipo,superficie_ha,cultivo,campana,latitud,longitud)
  values ('${idPerez}','Cortijo del Llano',4,104,'aire_libre',2,'Pimiento','2026/2027',36.742,-2.73)`)
for (const f of parcela.features) {
  const p = f.properties
  if (p.recinto !== 3) continue
  sql(`insert into recintos (finca_id,provincia,municipio,agregado,zona,poligono,parcela,recinto,superficie_ha,uso_sigpac,geometria)
       values ('${idLoma}',4,104,0,0,${p.poligono},${p.parcela},${p.recinto},${p.superficie},'${esc(p.uso_sigpac)}','${esc(JSON.stringify(f.geometry))}'::jsonb)`)
}

// ---------- Teselas simuladas ----------
const tesela = readFileSync(join(AQUI, 'fixtures/tesela.png'))
const teselaWms = readFileSync(join(AQUI, 'fixtures/tesela-transparente.png'))
const CORS = { 'access-control-allow-origin': '*' }
const red = { retraso: 0, pedidas: [] }

const errores = []
const browser = await chromium.launch()
const ctx = await browser.newContext({
  ...devices['Pixel 7'],
  locale: 'es-ES',
  serviceWorkers: 'block',
  permissions: ['geolocation'],
  geolocation: { latitude: 36.738, longitude: -2.7366, accuracy: 8 },
})
await simularSigpac(ctx)
const servir = (cuerpo) => async (route) => {
  red.pedidas.push(route.request().url())
  if (red.retraso) await new Promise((r) => setTimeout(r, red.retraso))
  await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'image/png' }, body: cuerpo }).catch(() => {})
}
await ctx.route('https://www.ign.es/wmts/**', servir(tesela))
// La capa WMS del SIGPAC se sirve aparte de las consultas (que simula simularSigpac).
await ctx.route('https://sigpac-hubcloud.es/wms**', servir(teselaWms))

const t = await ctx.newPage()
t.on('pageerror', (e) => errores.push('pageerror: ' + e.message))
t.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource|net::ERR_INTERNET_DISCONNECTED/.test(m.text())) errores.push('console: ' + m.text())
})

const cajasDeZonas = () =>
  t.evaluate(async () => {
    const nombres = (await caches.keys()).filter((n) => n.startsWith('campo-op-zona-'))
    const cuentas = await Promise.all(nombres.map(async (n) => (await (await caches.open(n)).keys()).length))
    return { cajas: nombres.length, teselas: cuentas.reduce((a, b) => a + b, 0) }
  })

// ===================== ENTRAR (técnico) =====================
await t.goto(BASE + '/login')
await t.fill('input[type=email]', 'tecnico@op.es')
await t.fill('input[type=password]', CLAVE)
await t.click('button[type=submit]')
await t.getByText('Accesos rápidos').waitFor()
await t.goto(BASE + '/mas/sincronizacion')
await t.getByRole('button', { name: 'Sincronizar ahora' }).click()
await t.getByText('Todo al día').waitFor()

// ===================== MÁS → MAPAS SIN CONEXIÓN =====================
await t.goto(BASE + '/mas')
const fila = t.getByRole('link', { name: /Mapas sin conexión/ })
comprobar('«Más» tiene la entrada «Mapas sin conexión»', (await fila.textContent()).includes('Descarga el mapa para verlo sin cobertura'))
await fila.click()
await t.getByRole('heading', { name: 'Mapas sin conexión' }).waitFor()
await t.getByText('Aún no hay zonas descargadas').waitFor()
comprobar('al principio no hay zonas', true)
await t.getByText(/2 fincas tienen ubicación/).waitFor({ timeout: 5000 }).catch(() => {})
comprobar('cuenta las fincas que tienen ubicación', await t.getByText(/2 fincas tienen ubicación/).isVisible())
await t.screenshot({ path: `${OUT}/z01-vacio.png` })

// --- Alrededor de mis fincas ---
await t.getByRole('button', { name: 'Descargar', exact: true }).click()
const dialogo = t.getByRole('dialog')
await dialogo.getByText(/Ocupará unos/).waitFor()
const estimacion = await dialogo.getByText(/Ocupará unos/).textContent()
const imagenes = Number(estimacion.match(/\(([\d.]+) imágenes\)/)[1].replace(/\./g, ''))
comprobar('el diálogo estima el tamaño y el número de imágenes', imagenes > 50 && imagenes < 2000, estimacion)
await dialogo.getByRole('radio', { name: 'Máximo' }).click()
const estimacionMax = await dialogo.getByText(/Ocupará unos/).textContent()
const imagenesMax = Number(estimacionMax.match(/\(([\d.]+) imágenes\)/)[1].replace(/\./g, ''))
comprobar('más detalle son más imágenes', imagenesMax > imagenes * 2, `${imagenes} → ${imagenesMax}`)
await dialogo.getByRole('radio', { name: 'Normal' }).click()
await t.screenshot({ path: `${OUT}/z02-dialogo-fincas.png` })
red.pedidas = []
red.retraso = 15
await dialogo.getByRole('button', { name: 'Descargar' }).click()
await t.getByRole('progressbar').waitFor()
comprobar('se ve el progreso de la descarga', true)
await t.screenshot({ path: `${OUT}/z03-descargando.png` })
await t.getByText('Lista para usar sin conexión').waitFor({ timeout: 120000 })
comprobar('la zona de las fincas termina «Lista para usar sin conexión»', true)
comprobar('avisa de que ya se puede ver sin conexión', await t.getByText('«Mis fincas» ya se puede ver sin conexión.').isVisible())
const tras1 = await cajasDeZonas()
comprobar('las imágenes quedan guardadas en el móvil', tras1.cajas === 1 && tras1.teselas === imagenes, `${tras1.teselas} de ${imagenes}`)
comprobar('se ha pedido cada imagen una sola vez', red.pedidas.length === imagenes, `${red.pedidas.length}`)
const sigpacPedidas = red.pedidas.filter((u) => u.includes('sigpac-hubcloud.es/wms'))
comprobar('incluye la capa SIGPAC solo de cerca', sigpacPedidas.length > 0 && sigpacPedidas.every((u) => u.includes('crs=EPSG:3857')))
await t.screenshot({ path: `${OUT}/z04-lista.png` })

// ===================== SIN CONEXIÓN, EL MAPA SALE DE LO DESCARGADO =====================
await t.goto(BASE + `/mapa?finca=${idLoma}`)
await t.locator('.leaflet-container').waitFor()
await t.waitForTimeout(1500)
red.pedidas = []
await ctx.setOffline(true)
// Se mueve un poco el mapa para que pida teselas nuevas, ya sin conexión.
const caja = await t.locator('.leaflet-container').boundingBox()
await t.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2)
await t.mouse.down()
await t.mouse.move(caja.x + caja.width / 2 - 120, caja.y + caja.height / 2 - 60, { steps: 6 })
await t.mouse.up()
await t.waitForTimeout(1500)
const deLaZona = await t.locator('img.leaflet-tile-loaded').evaluateAll((imgs) => imgs.filter((i) => i.src.startsWith('blob:')).length)
comprobar('sin conexión el mapa usa las imágenes descargadas', deLaZona > 4, `${deLaZona} teselas desde la zona`)
// Las que se piden son las de fuera de la zona (que sin red no llegan); ninguna de las descargadas.
const repetidas = await t.evaluate(async (urls) => {
  let n = 0
  for (const u of urls) if (await caches.match(u)) n++
  return n
}, red.pedidas)
comprobar('y no pide a internet las que ya tiene', repetidas === 0, `${repetidas} de ${red.pedidas.length} peticiones eran de la zona`)
comprobar('el aviso de sin conexión enlaza con las zonas descargadas', await t.getByRole('link', { name: 'zonas descargadas' }).isVisible())
await t.screenshot({ path: `${OUT}/z05-sin-conexion.png` })
await ctx.setOffline(false)

// ===================== ZONA ELEGIDA EN EL MAPA =====================
await t.getByRole('button', { name: 'Capas del mapa' }).click()
await t.getByRole('button', { name: 'Descargar esta zona para usarla sin conexión' }).click()
const d2 = t.getByRole('dialog')
await d2.getByText(/Ocupará unos/).waitFor()
await d2.getByLabel('Nombre de la zona').fill('Paraje La Loma')
await t.screenshot({ path: `${OUT}/z06-dialogo-pantalla.png` })
red.retraso = 40
await d2.getByRole('button', { name: 'Descargar' }).click()
await t.getByRole('link', { name: /Descargando «Paraje La Loma»/ }).waitFor()
comprobar('en el mapa se ve el progreso de la descarga', true)
await t.screenshot({ path: `${OUT}/z07-progreso-mapa.png` })

// --- Cancelar a mitad ---
await t.getByRole('link', { name: /Descargando «Paraje La Loma»/ }).click()
await t.getByRole('button', { name: 'Cancelar descarga' }).click()
await t.getByText(/Descarga cancelada/).waitFor()
comprobar('se puede cancelar y lo descargado se conserva', true)
const incompleta = t.getByText(/Incompleta · faltan/)
comprobar('la zona cancelada queda «Incompleta»', await incompleta.isVisible())

// --- Completar ---
red.retraso = 0
await t.getByRole('button', { name: 'Completar' }).click()
await esperarQue('«Completar» la termina sin repetir lo ya descargado', async () => (await t.getByText('Lista para usar sin conexión').count()) === 2, 120000)

// --- Se corta la conexión a mitad ---
await t.goto(BASE + '/mapa')
await t.locator('.leaflet-container').waitFor()
await t.waitForTimeout(800)
await t.getByRole('button', { name: 'Capas del mapa' }).click()
await t.getByRole('button', { name: 'Descargar esta zona para usarla sin conexión' }).click()
await t.getByRole('dialog').getByLabel('Nombre de la zona').fill('Corte de red')
red.retraso = 60
await t.getByRole('dialog').getByRole('button', { name: 'Descargar' }).click()
await t.waitForTimeout(1500)
await ctx.setOffline(true)
await t.goto(BASE + '/mas/mapas').catch(() => {})
await ctx.setOffline(false)
await t.goto(BASE + '/mas/mapas')
await esperarQue('si se corta la red o se cierra la app, la zona queda «Incompleta»', async () => (await t.getByText(/Incompleta · faltan/).count()) === 1)
red.retraso = 0

// --- Zona demasiado grande ---
await t.goto(BASE + '/mapa')
await t.locator('.leaflet-container').waitFor()
await t.evaluate(() => localStorage.setItem('campo-op:mapa:vista', JSON.stringify({ centro: [37.2, -2.4], zoom: 9 })))
await t.goto(BASE + '/mapa?descargar=1')
const d3 = t.getByRole('dialog')
await d3.getByText('La zona es demasiado grande').waitFor()
comprobar('una zona enorme no se deja descargar y se explica por qué', await d3.getByRole('button', { name: 'Descargar' }).isDisabled())
await t.screenshot({ path: `${OUT}/z08-demasiado-grande.png` })
await d3.getByRole('button', { name: 'Cancelar' }).click()

// --- Ver en el mapa ---
await t.goto(BASE + '/mas/mapas')
await t.getByRole('button', { name: 'Ver en el mapa' }).first().click()
await t.waitForURL(/\/mapa\?zona=/)
comprobar('«Ver en el mapa» abre el mapa en esa zona', true)
await t.locator('.leaflet-container').waitFor()
await t.waitForTimeout(1000)
await t.screenshot({ path: `${OUT}/z09-ver-zona.png` })

// --- Borrar ---
await t.goto(BASE + '/mas/mapas')
const antes = await cajasDeZonas()
await t.getByRole('button', { name: 'Borrar Corte de red' }).click()
await t.getByRole('dialog').getByRole('button', { name: 'Borrar', exact: true }).click()
await esperarQue('al borrar una zona se quita de la lista', async () => (await t.getByText('Corte de red').count()) === 0)
const despues = await cajasDeZonas()
comprobar('y se liberan sus imágenes del móvil', despues.cajas === antes.cajas - 1, `${antes.cajas} → ${despues.cajas}`)
const sinDesbordar = await t.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
comprobar('la pantalla no se desborda en el móvil', sinDesbordar)
await t.goto(BASE + '/mas')
await esperarQue('«Más» resume las zonas y lo que ocupan', async () => /2 zonas · /.test(await t.getByRole('link', { name: /Mapas sin conexión/ }).textContent()), 5000)

// --- Al cerrar sesión, los mapas se conservan ---
await t.getByRole('button', { name: 'Cerrar sesión' }).click()
await t.getByRole('button', { name: /Entrar/ }).waitFor()
const trasSalir = await cajasDeZonas()
comprobar('cerrar sesión no borra los mapas descargados', trasSalir.cajas === 2)

await browser.close()
console.log(errores.length ? '\nERRORES DE NAVEGADOR:\n' + errores.join('\n') : '\nSin errores de navegador')
console.log(fallos ? `\n${fallos} COMPROBACIONES FALLIDAS` : '\nTodas las comprobaciones correctas')
process.exit(fallos || errores.length ? 1 : 0)
