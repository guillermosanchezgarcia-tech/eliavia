// Prueba de extremo a extremo de las fincas (parte 3) contra un Supabase local
// real: alta con recintos SIGPAC, superficie en ha y m², GPS, fotos (también
// sin conexión), permisos del técnico, filtros, edición y borrado en cascada.
//
// El SIGPAC se simula con respuestas reales grabadas (pruebas/fixtures/sigpac).
// Con SIGPAC_REAL=1 se usa el servicio público de verdad.
//
// Cómo ejecutarla: ver pruebas/README.md.
//   node pruebas/e2e-fincas.mjs [carpeta-para-capturas]

import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { simularSigpac } from './ayudas.mjs'

const { chromium, devices } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')

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

const errores = []
const browser = await chromium.launch()

async function nuevoMovil(opciones = {}) {
  const ctx = await browser.newContext({
    ...devices['Pixel 7'],
    locale: 'es-ES',
    serviceWorkers: 'block',
    permissions: ['geolocation'],
    geolocation: { latitude: 36.738, longitude: -2.7366, accuracy: 8 },
    ...opciones,
  })
  await simularSigpac(ctx)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errores.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/409|400|Failed to load resource/.test(m.text())) errores.push('console: ' + m.text())
  })
  return { ctx, page }
}

async function entrar(page, email) {
  await page.goto(BASE + '/login')
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', CLAVE)
  await page.click('button[type=submit]')
  await page.getByText('Accesos rápidos').waitFor()
}

/** Una foto grande de verdad (3000×2000), hecha en el navegador. */
async function fotoGrande(page, color = '#2f855a') {
  const base64 = await page.evaluate(async (c) => {
    const lienzo = document.createElement('canvas')
    lienzo.width = 3000
    lienzo.height = 2000
    const ctx = lienzo.getContext('2d')
    const degradado = ctx.createLinearGradient(0, 0, 3000, 2000)
    degradado.addColorStop(0, c)
    degradado.addColorStop(1, '#ecc94b')
    ctx.fillStyle = degradado
    ctx.fillRect(0, 0, 3000, 2000)
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = `rgba(${(i * 37) % 255},${(i * 91) % 255},${(i * 53) % 255},0.5)`
      ctx.fillRect((i * 97) % 3000, (i * 61) % 2000, 20, 20)
    }
    const blob = await new Promise((r) => lienzo.toBlob(r, 'image/jpeg', 0.95))
    const buf = new Uint8Array(await blob.arrayBuffer())
    let s = ''
    for (const b of buf) s += String.fromCharCode(b)
    return btoa(s)
  }, color)
  return { name: 'campo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(base64, 'base64') }
}

// Datos de partida: dos socios.
sql(`insert into socios (codigo, nombre, localidad) values ('0001','Agrícola Pérez SL','El Ejido'), ('0002','Hortalizas Níjar SAT','Níjar')`)
const idPerez = sql("select id from socios where codigo='0001'")

// ===================== ADMINISTRADOR =====================
const { ctx: ctxA, page: a } = await nuevoMovil()
await entrar(a, 'admin@op.es')
await a.getByRole('link', { name: 'Fincas' }).last().click()
await a.getByText('Todavía no hay fincas').waitFor()
await a.screenshot({ path: `${OUT}/f01-fincas-vacio.png` })

// --- Alta de una finca completa ---
await a.getByRole('link', { name: 'Nueva finca' }).click()
await a.getByLabel('Nombre o código de la finca *').waitFor()
await a.getByRole('button', { name: 'Crear finca' }).click()
await a.getByText('Elige el socio al que pertenece la finca.').waitFor()
await a.getByText('Escribe el nombre o código de la finca.').waitFor()
comprobar('no deja crear una finca sin socio ni nombre', a.url().endsWith('/fincas/nueva'))

await a.getByRole('button', { name: /Elegir socio/ }).click()
await a.getByRole('dialog').getByLabel('Buscar socio').fill('perez')
await a.getByRole('dialog').getByRole('button', { name: /Agrícola Pérez SL/ }).click()
await a.getByLabel('Nombre o código de la finca *').fill('La Loma')
await a.getByLabel('Municipio').selectOption({ label: 'El Ejido' })
await a.getByRole('radio', { name: 'Invernadero' }).click()
await a.getByLabel('Tipo de invernadero').selectOption({ label: 'Raspa y amagado' })

// Superficie: hectáreas y m² van a la par
await a.getByLabel('Superficie (ha)').fill('1,25')
comprobar('1,25 ha → 12500 m²', (await a.getByLabel('Superficie (m²)').inputValue()) === '12500')
await a.getByLabel('Superficie (m²)').fill('13000')
comprobar('13000 m² → 1,3 ha', (await a.getByLabel('Superficie (ha)').inputValue()) === '1,3')

await a.getByLabel('Cultivo actual').fill('Tomate')
const campana = await a.getByLabel('Campaña').inputValue()
comprobar('la campaña actual viene elegida', /^\d{4}\/\d{4}$/.test(campana), campana)
await a.getByRole('checkbox', { name: 'GlobalG.A.P.' }).click()
await a.getByLabel('Otra certificación').fill('BRC')
await a.getByRole('button', { name: 'Añadir' }).click()
comprobar('certificación nueva añadida y marcada', (await a.getByRole('checkbox', { name: 'BRC' }).getAttribute('aria-checked')) === 'true')

// Recinto SIGPAC por referencia
await a.getByRole('button', { name: 'Por referencia' }).click()
await a.getByRole('dialog').getByLabel('Municipio').selectOption({ label: 'El Ejido' })
await a.getByRole('dialog').getByLabel('Polígono').fill('23')
await a.getByRole('dialog').getByLabel('Parcela').fill('372')
await a.getByRole('dialog').getByRole('button', { name: 'Buscar' }).click()
await a.getByText('La parcela tiene 3 recintos').waitFor()
await a.screenshot({ path: `${OUT}/f02-buscar-sigpac.png` })
comprobar('la parcela ofrece sus 3 recintos', (await a.getByRole('dialog').getByRole('checkbox').count()) === 3)
await a.getByRole('dialog').getByRole('checkbox', { name: /Recinto 3/ }).click()
await a.getByRole('dialog').getByRole('button', { name: /Añadir 1 recinto/ }).click()
await a.getByText('Pol. 23 · Parc. 372 · Rec. 3').waitFor()
await a.getByRole('button', { name: /Usar la superficie de los recintos SIGPAC/ }).click()
comprobar('superficie tomada del recinto', (await a.getByLabel('Superficie (ha)').inputValue()) === '3,4527' && (await a.getByLabel('Superficie (m²)').inputValue()) === '34527')

// Buscar una referencia que no existe
await a.getByRole('button', { name: 'Por referencia' }).click()
await a.getByRole('dialog').getByLabel('Municipio').selectOption({ label: 'El Ejido' })
await a.getByRole('dialog').getByLabel('Polígono').fill('99')
await a.getByRole('dialog').getByLabel('Parcela').fill('9')
await a.getByRole('dialog').getByRole('button', { name: 'Buscar' }).click()
await a.getByText('El SIGPAC no tiene esa referencia').waitFor()
comprobar('referencia inexistente avisa', true)
await a.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()

// Punto GPS
await a.getByRole('button', { name: 'Usar mi posición' }).click()
await a.getByText(/precisión ±8 m/).waitFor()
comprobar('GPS rellena latitud y longitud', (await a.getByLabel('Latitud').inputValue()).startsWith('36,738') && (await a.getByLabel('Longitud').inputValue()).startsWith('-2,7366'))
await a.getByLabel('Latitud').fill('-2,7')
await a.getByRole('button', { name: 'Crear finca' }).click()
await a.getByText(/no parecen estar en España/).waitFor()
comprobar('coordenadas fuera de España se rechazan', a.url().endsWith('/fincas/nueva'))
await a.getByRole('button', { name: 'Usar mi posición' }).click()
await a.getByText(/precisión ±8 m/).waitFor()
await a.getByRole('button', { name: 'Hoy' }).click()
await a.getByLabel('Observaciones').fill('Invernadero de 2018, riego por goteo.')
await a.screenshot({ path: `${OUT}/f03-formulario.png`, fullPage: true })
await a.getByRole('button', { name: 'Crear finca' }).click()
await a.waitForURL(/\/fincas\/[0-9a-f-]{36}$/)
const idLoma = a.url().split('/').pop()

await esperarQue('la finca llega a Supabase con todos sus datos', () =>
  sql(`select count(*) from fincas where id='${idLoma}' and socio_id='${idPerez}' and nombre='La Loma' and municipio=104 and tipo='invernadero' and tipo_invernadero='raspa_amagado' and superficie_ha=3.4527 and cultivo='Tomate' and certificaciones = '{GlobalG.A.P.,BRC}' and fecha_ultima_visita = current_date and latitud between 36.7 and 36.8`) === '1',
)
await esperarQue('el recinto llega con su contorno', () =>
  sql(`select count(*) from recintos where finca_id='${idLoma}' and poligono=23 and parcela=372 and recinto=3 and superficie_ha=3.4527 and uso_sigpac='IV' and geometria->>'type'='Polygon'`) === '1',
)

// --- Ficha ---
await a.getByText('Pol. 23 · Parc. 372 · Rec. 3').waitFor()
const enlace = await a.getByRole('link', { name: 'Cómo llegar' }).getAttribute('href')
comprobar('«Cómo llegar» abre Google Maps con el punto GPS', /google\.com\/maps\/dir\/\?api=1&destination=36\.73\d+,-2\.73\d+/.test(enlace ?? ''), enlace ?? '')
comprobar('la ficha muestra superficie en ha y m²', (await a.getByText('3,4527 ha').count()) > 0 && (await a.getByText('34.527 m²').count()) > 0)
await a.getByText('Invernadero raspa y amagado').first().waitFor()
await a.screenshot({ path: `${OUT}/f04-ficha-finca.png`, fullPage: true })

// --- Registrar visita ---
sql(`update fincas set fecha_ultima_visita = '2026-01-10' where id='${idLoma}'`)
await a.goto(BASE + '/mas/sincronizacion')
await a.getByRole('button', { name: 'Sincronizar ahora' }).click()
await a.getByText('Todo al día').waitFor()
await a.goto(BASE + `/fincas/${idLoma}`)
await a.getByText('10/01/2026').waitFor()
await a.getByRole('button', { name: 'Registrar visita de hoy' }).click()
await a.getByRole('button', { name: 'Visita de hoy registrada' }).waitFor()
await esperarQue('la visita de hoy llega a Supabase', () => sql(`select fecha_ultima_visita = current_date from fincas where id='${idLoma}'`) === 't')

// --- Fotos ---
const input = a.locator('input[aria-label="Elegir fotos de la galería"]')
await input.setInputFiles(await fotoGrande(a))
await a.locator('ul img').first().waitFor()
await esperarQue('la foto se sube a Storage', () => sql(`select count(*) from storage.objects where bucket_id='fotos' and name like 'fincas/${idLoma}/%'`) === '1')
const tamano = Number(sql(`select (metadata->>'size')::int from storage.objects where bucket_id='fotos' and name like 'fincas/${idLoma}/%'`))
comprobar('la foto se reduce antes de subirla', tamano > 20000 && tamano < 700000, `${Math.round(tamano / 1024)} KB`)
await esperarQue('la foto se da de alta en la base de datos', () => sql(`select count(*) from fotos where finca_id='${idLoma}' and not eliminado`) === '1')

// Sin conexión: la foto se guarda en el móvil y sube al volver
await ctxA.setOffline(true)
await input.setInputFiles(await fotoGrande(a, '#2b6cb0'))
await a.locator('ul img').nth(1).waitFor()
await a.getByLabel('Pendiente de subir').first().waitFor()
await a.screenshot({ path: `${OUT}/f05-foto-sin-conexion.png`, fullPage: true })
comprobar('sin conexión la foto queda pendiente en el móvil', sql(`select count(*) from storage.objects where bucket_id='fotos' and name like 'fincas/${idLoma}/%'`) === '1')
await ctxA.setOffline(false)
await esperarQue('al volver la red se sube la foto', () => sql(`select count(*) from storage.objects where bucket_id='fotos' and name like 'fincas/${idLoma}/%'`) === '2')
await esperarQue('y se da de alta', () => sql(`select count(*) from fotos where finca_id='${idLoma}' and not eliminado`) === '2')

// Visor: descripción
await a.locator('ul button:has(img)').first().click()
await a.getByRole('dialog', { name: 'Foto de la finca' }).waitFor()
await a.getByLabel('Descripción de la foto').fill('Plaga en cabecera')
await a.getByRole('button', { name: 'Cerrar' }).click()
await esperarQue('la descripción de la foto se guarda', () => sql(`select count(*) from fotos where finca_id='${idLoma}' and descripcion='Plaga en cabecera'`) === '1')

// ===================== TÉCNICO =====================
const { ctx: ctxT, page: t } = await nuevoMovil()
await entrar(t, 'tecnico@op.es')
await t.goto(BASE + '/fincas')
await t.getByText('La Loma').waitFor({ timeout: 30000 })
await t.getByText('La Loma').click()
await t.getByText('Pol. 23 · Parc. 372 · Rec. 3').waitFor()
comprobar('el técnico no ve «Eliminar finca»', (await t.getByRole('button', { name: 'Eliminar finca' }).count()) === 0)
// Las fotos se descargan de Storage al verlas
await t.locator('ul img').nth(1).waitFor()
const cargadas = await t.locator('ul img').evaluateAll((imgs) => imgs.map((i) => i.naturalWidth))
comprobar('el técnico ve las fotos descargadas de Storage', cargadas.length === 2 && cargadas.every((w) => w > 0 && w <= 1600), cargadas.join(', '))
// Y quedan guardadas: sin conexión se siguen viendo
await ctxT.setOffline(true)
await t.reload().catch(() => {})
await ctxT.setOffline(false)
await t.goto(BASE + `/fincas/${idLoma}`)
await t.getByText('Pol. 23 · Parc. 372 · Rec. 3').waitFor()
await ctxT.setOffline(true)
await t.locator('ul img').nth(1).waitFor()
comprobar('las fotos vistas se ven sin conexión', (await t.locator('ul img').count()) === 2)
await ctxT.setOffline(false)

// El técnico edita la finca y añade un recinto desde su posición
await t.getByRole('link', { name: 'Editar' }).click()
await t.getByLabel('Cultivo actual').fill('Pepino')
await t.getByRole('button', { name: 'Mi posición', exact: true }).click()
await t.getByText('Estás dentro de este recinto').waitFor()
await t.screenshot({ path: `${OUT}/f06-recinto-posicion.png` })
await t.getByRole('dialog').getByRole('button', { name: 'Añadir recinto' }).click()
comprobar('el mismo recinto no se añade dos veces', (await t.getByText('Pol. 23 · Parc. 372 · Rec. 3').count()) === 1)
await t.getByRole('button', { name: 'Guardar cambios' }).click()
await t.waitForURL(new RegExp(`/fincas/${idLoma}$`))
await esperarQue('la edición del técnico llega a Supabase', () =>
  sql(`select p.email from fincas f join perfiles p on p.id = f.updated_by where f.id='${idLoma}' and f.cultivo='Pepino'`) === 'tecnico@op.es',
)

// El técnico crea una finca nueva desde la ficha del socio, con un recinto desde su posición
await t.goto(BASE + '/socios')
await t.getByText('Hortalizas Níjar SAT').click()
await t.getByRole('link', { name: 'Añadir finca' }).click()
await t.getByLabel('Nombre o código de la finca *').waitFor()
comprobar('el socio viene elegido al añadir desde su ficha', (await t.getByRole('button', { name: /Hortalizas Níjar SAT/ }).count()) === 1)
await t.getByLabel('Nombre o código de la finca *').fill('El Cerro')
await t.getByRole('radio', { name: 'Aire libre' }).click()
comprobar('aire libre no pide tipo de invernadero', (await t.getByLabel('Tipo de invernadero').count()) === 0)
await t.getByLabel('Cultivo actual').fill('Pimiento')
await t.getByRole('button', { name: 'Mi posición', exact: true }).click()
await t.getByText('Estás dentro de este recinto').waitFor()
await t.getByRole('dialog').getByRole('button', { name: 'Añadir recinto' }).click()
comprobar('la superficie se rellena con la del recinto si estaba vacía', (await t.getByLabel('Superficie (ha)').inputValue()) === '3,4527')
comprobar('el municipio se rellena con el del recinto', (await t.getByLabel('Municipio').first().inputValue()) === '104')
comprobar('y también el punto GPS', (await t.getByLabel('Latitud').inputValue()).startsWith('36,738'))
await t.getByRole('button', { name: 'Crear finca' }).click()
await t.waitForURL(/\/fincas\/[0-9a-f-]{36}$/)
const idCerro = t.url().split('/').pop()
await esperarQue('la finca nueva llega con su recinto (el orden de envío es correcto)', () =>
  sql(`select count(*) from fincas f join recintos r on r.finca_id=f.id where f.id='${idCerro}' and f.tipo='aire_libre' and f.tipo_invernadero is null`) === '1',
)

// ===================== LISTADO Y FILTROS =====================
sql(`insert into fincas (socio_id, nombre, municipio, tipo, superficie_ha, cultivo, certificaciones)
     values ('${idPerez}', 'Balsa Nueva', 66, 'invernadero', 2.5, 'Tomate', '{GlobalG.A.P.}')`)
await a.goto(BASE + '/mas/sincronizacion')
await a.getByRole('button', { name: 'Sincronizar ahora' }).click()
await a.getByText('Todo al día').waitFor()
await a.goto(BASE + '/fincas')
await a.getByText('Balsa Nueva').waitFor()
const subtitulo = async () => (await a.locator('header p').first().innerText()).trim()
comprobar('el listado suma las hectáreas', /^3 fincas · /.test(await subtitulo()), await subtitulo())
await a.screenshot({ path: `${OUT}/f07-listado-fincas.png` })

await a.getByLabel('Buscar finca').fill('pol 23 parc 372')
await a.getByText('La Loma').waitFor()
// «El Cerro» comparte esa referencia (usa el mismo recinto de prueba); «Balsa Nueva» no tiene recintos.
comprobar('se busca por polígono y parcela', (await a.getByText('Balsa Nueva').count()) === 0 && (await a.getByText('El Cerro').count()) === 1)
await a.getByLabel('Buscar finca').fill('nijar')
await a.getByText('Balsa Nueva').waitFor()
comprobar('se busca por nombre de socio o municipio sin tildes', (await a.getByText('La Loma').count()) === 0)
await a.getByLabel('Buscar finca').fill('')

await a.getByRole('button', { name: /^Filtros/ }).click()
await a.getByRole('dialog').getByLabel('Cultivo').selectOption({ label: 'Pimiento (1)' })
await a.getByRole('dialog').getByRole('button', { name: /Ver 1 finca/ }).click()
await a.getByText('El Cerro').waitFor()
comprobar('filtro por cultivo', (await a.getByText('La Loma').count()) === 0 && (await a.getByText('Balsa Nueva').count()) === 0)
await a.getByRole('button', { name: 'Quitar el filtro Pimiento' }).click()
await a.getByText('Balsa Nueva').waitFor()

await a.goto(BASE + '/fincas?tipo=invernadero&certificacion=GlobalG.A.P.&municipio=4:66')
await a.getByText('Balsa Nueva').waitFor()
comprobar('filtros combinados (tipo + certificación + municipio)', (await a.locator('a[href^="/fincas/"]:not([href="/fincas/nueva"])').count()) === 1)
await a.getByRole('button', { name: /^Filtros/ }).click()
await a.screenshot({ path: `${OUT}/f08-filtros.png` })
await a.getByRole('dialog').getByRole('button', { name: 'Quitar filtros' }).click()
await a.getByRole('dialog').getByRole('button', { name: /Ver 3 fincas/ }).click()
await a.goto(BASE + '/fincas?orden=superficie')
await a.getByText('Balsa Nueva').waitFor()
// «El Cerro» y «La Loma» empatan en superficie; «Balsa Nueva» (2,5 ha) es la menor. Por nombre sería la primera.
const ultima = await a.locator('a[href^="/fincas/"]:not([href="/fincas/nueva"])').last().innerText()
comprobar('ordenar por superficie (mayor primero)', ultima.startsWith('Balsa Nueva'), ultima.split('\n')[0])

// ===================== FOTO RECHAZADA POR EL SERVIDOR =====================
// El servidor responde 403 a la subida: la app avisa, conserva la foto y deja reintentar.
const idBalsaFoto = sql("select id from fincas where nombre='Balsa Nueva'")
const rutaStorage = '**/storage/v1/object/fotos/**'
await a.route(rutaStorage, (route) =>
  route.request().method() === 'POST'
    ? route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' }),
      })
    : route.continue(),
)
await a.goto(BASE + `/fincas/${idBalsaFoto}`)
await a.locator('input[aria-label="Elegir fotos de la galería"]').setInputFiles(await fotoGrande(a, '#975a16'))
await a.getByText('1 con error').waitFor({ timeout: 20000 })
comprobar('una subida rechazada no se sube pero avisa', sql(`select count(*) from storage.objects where name like 'fincas/${idBalsaFoto}/%'`) === '0')
comprobar('y la foto sigue en el móvil', (await a.locator('ul img').count()) === 1)
await a.getByText('1 con error').click()
await a.getByText(/No se ha podido subir la foto\. No tienes permiso para subir fotos/).waitFor()
await a.screenshot({ path: `${OUT}/f11-foto-rechazada.png` })
await a.unroute(rutaStorage)
await a.getByRole('button', { name: 'Reintentar' }).click()
await esperarQue('al reintentar, la foto se sube', () => sql(`select count(*) from storage.objects where name like 'fincas/${idBalsaFoto}/%'`) === '1')
await a.getByText('Todo al día').waitFor()
await esperarQue('y se da de alta', () => sql(`select count(*) from fotos where finca_id='${idBalsaFoto}' and not eliminado`) === '1')

// ===================== EDITAR: quitar un recinto =====================
await a.goto(BASE + `/fincas/${idLoma}/editar`)
await a.getByText('Pol. 23 · Parc. 372 · Rec. 3').waitFor()
await a.getByRole('button', { name: /Quitar Pol\. 23/ }).click()
await a.getByRole('button', { name: 'Guardar cambios' }).click()
await a.waitForURL(new RegExp(`/fincas/${idLoma}$`))
await esperarQue('quitar un recinto lo elimina en Supabase', () => sql(`select count(*) from recintos where finca_id='${idLoma}' and not eliminado`) === '0')
await a.getByText('Esta finca no tiene recintos SIGPAC').waitFor()
comprobar('«Cómo llegar» sigue funcionando con el punto GPS', (await a.getByRole('link', { name: 'Cómo llegar' }).count()) === 1)

// ===================== ELIMINAR (admin) =====================
await a.getByRole('button', { name: 'Eliminar finca' }).click()
await a.screenshot({ path: `${OUT}/f09-eliminar-finca.png` })
await a.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click()
await a.waitForURL(BASE + '/fincas')
await esperarQue('la finca eliminada y sus fotos lo están en Supabase', () =>
  sql(`select (select eliminado from fincas where id='${idLoma}') and (select bool_and(eliminado) from fotos where finca_id='${idLoma}')`) === 't',
)
await t.goto(BASE + '/mas/sincronizacion')
await t.getByRole('button', { name: 'Sincronizar ahora' }).click()
await t.getByText('Todo al día').waitFor()
await t.goto(BASE + '/fincas')
await t.getByText('El Cerro').waitFor()
comprobar('el técnico deja de ver la finca eliminada', (await t.getByText('La Loma').count()) === 0)

// Eliminar un socio elimina sus fincas también en el móvil
await a.goto(BASE + '/socios')
await a.getByText('Hortalizas Níjar SAT').click()
await a.getByText('El Cerro').first().waitFor()
await a.getByRole('button', { name: 'Eliminar socio' }).click()
await a.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click()
await a.waitForURL(BASE + '/socios')
await a.goto(BASE + '/fincas')
await a.getByText('Balsa Nueva').waitFor()
comprobar('al eliminar un socio desaparecen sus fincas', (await a.getByText('El Cerro').count()) === 0)

// ===================== ORDENADOR Y MÓVIL ESTRECHO =====================
const pc = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-ES', serviceWorkers: 'block' })
await simularSigpac(pc)
const q = await pc.newPage()
q.on('pageerror', (e) => errores.push('pageerror pc: ' + e.message))
await entrar(q, 'admin@op.es')
await q.goto(BASE + `/fincas/${idPerez ? sql("select id from fincas where nombre='Balsa Nueva'") : ''}`)
await q.getByText('Datos').first().waitFor()
await q.screenshot({ path: `${OUT}/f10-ficha-ordenador.png`, fullPage: true })

const estrecho = await browser.newContext({ viewport: { width: 320, height: 640 }, locale: 'es-ES', serviceWorkers: 'block' })
await simularSigpac(estrecho)
const r = await estrecho.newPage()
await entrar(r, 'admin@op.es')
const idBalsa = sql("select id from fincas where nombre='Balsa Nueva'")
for (const ruta of ['/fincas', `/fincas/${idBalsa}`, `/fincas/${idBalsa}/editar`, '/fincas/nueva']) {
  await r.goto(BASE + ruta)
  await r.waitForTimeout(900)
  const ancho = await r.evaluate(() => document.documentElement.scrollWidth)
  if (ancho > 320) errores.push(`desborde horizontal en ${ruta}: ${ancho}px`)
}

await browser.close()
console.log(errores.length ? '\nERRORES DE NAVEGADOR:\n' + errores.join('\n') : '\nSin errores de navegador')
console.log(fallos ? `\n${fallos} COMPROBACIONES FALLIDAS` : '\nTodas las comprobaciones correctas')
process.exit(fallos || errores.length ? 1 : 0)
