// Prueba de extremo a extremo de los socios (parte 2) contra un Supabase local
// real: altas, validaciones, trabajo sin conexión, sincronización, conflictos,
// permisos del técnico, borrado y descarga de miles de socios.
//
// Cómo ejecutarla: ver pruebas/README.md.
//   node pruebas/e2e-socios.mjs [carpeta-para-capturas]

import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

// Playwright no es dependencia del proyecto: se usa el que haya instalado en
// el ordenador (npm i -g playwright) o el que indique PLAYWRIGHT_MODULE.
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
async function esperarQue(nombre, fn, ms = 15000) {
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

async function nuevoMovil() {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'es-ES', serviceWorkers: 'block' })
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

// ===================== ADMINISTRADOR =====================
const { ctx: ctxA, page: a } = await nuevoMovil()
await entrar(a, 'admin@op.es')
await a.getByRole('link', { name: 'Socios' }).last().click()
await a.getByText('Todavía no hay socios').waitFor()
await a.screenshot({ path: `${OUT}/01-socios-vacio.png` })

// --- Alta con validación ---
await a.getByRole('link', { name: 'Nuevo socio' }).click()
await a.getByLabel('Código de socio *').waitFor()
comprobar('código propuesto para el primer socio', (await a.getByLabel('Código de socio *').inputValue()) === '1')
await a.getByLabel('Código de socio *').fill('0001')
await a.getByLabel('Nombre o razón social *').fill('Agrícola Pérez SL')
await a.getByLabel('NIF / CIF').fill('b04000001')
await a.getByLabel('Teléfono').fill('600 11 22 33')
await a.getByLabel('Email').fill('perez@ejemplo.es')
await a.getByLabel('Calle y número').fill('Ctra. de Almerimar, 12')
await a.getByLabel('C. postal').fill('04700')
await a.getByLabel('Localidad').fill('El Ejido')
await a.getByRole('button', { name: 'Dar de alta' }).click()
await a.getByText('no cuadra').waitFor()
await a.screenshot({ path: `${OUT}/02-formulario-error-nif.png`, fullPage: true })
comprobar('NIF con errata bloquea el guardado', a.url().endsWith('/socios/nuevo'))
await a.getByLabel('NIF / CIF').fill('B04000006')
await a.getByText('CIF correcto.').waitFor()
await a.getByRole('button', { name: 'Dar de alta' }).click()
await a.waitForURL(/\/socios\/[0-9a-f-]{36}$/)
await a.getByText('Ctra. de Almerimar, 12, 04700 El Ejido').waitFor()
await esperarQue('el socio llega a Supabase', () => sql("select count(*) from socios where codigo='0001' and nif='B04000006'") === '1')
const autor = sql("select p.email from socios s join perfiles p on p.id = s.created_by where s.codigo='0001'")
comprobar('Supabase apunta quién lo creó', autor === 'admin@op.es', autor)
await a.getByText('Última modificación').waitFor()
await a.screenshot({ path: `${OUT}/03-ficha-socio.png`, fullPage: true })

// --- Segundo socio: el código propuesto sigue la numeración ---
await a.goto(BASE + '/socios/nuevo')
await a.getByLabel('Código de socio *').waitFor()
comprobar('propone el siguiente código (0002)', (await a.getByLabel('Código de socio *').inputValue()) === '0002')
await a.getByLabel('Nombre o razón social *').fill('Hortalizas Níjar SAT')
await a.getByLabel('Localidad').fill('Níjar')
await a.getByRole('button', { name: 'Dar de alta' }).click()
await a.waitForURL(/\/socios\/[0-9a-f-]{36}$/)

// --- Código repetido se detecta en el móvil ---
await a.goto(BASE + '/socios/nuevo')
await a.getByLabel('Código de socio *').fill('0001')
await a.getByLabel('Nombre o razón social *').fill('Repetido')
await a.getByRole('button', { name: 'Dar de alta' }).click()
await a.getByText('Ya hay otro socio con este código.').waitFor()
comprobar('código repetido bloquea el alta', a.url().endsWith('/socios/nuevo'))

// --- Sin conexión: alta guardada en el móvil y enviada al volver ---
await a.goto(BASE + '/socios')
await a.getByText('Hortalizas Níjar SAT').waitFor()
await ctxA.setOffline(true)
await a.getByRole('link', { name: 'Nuevo socio' }).click()
await a.getByLabel('Nombre o razón social *').fill('Finca Los Olivos CB')
await a.getByLabel('Localidad').fill('Vícar')
await a.getByRole('button', { name: 'Dar de alta' }).click()
await a.waitForURL(/\/socios\/[0-9a-f-]{36}$/)
await a.getByText('Cambios sin enviar').waitFor()
await a.getByText('Sin conexión · 1').waitFor()
await a.screenshot({ path: `${OUT}/04-sin-conexion-pendiente.png` })
comprobar('sin conexión no llega a Supabase', sql("select count(*) from socios where nombre='Finca Los Olivos CB'") === '0')
await ctxA.setOffline(false)
await esperarQue('al volver la red se envía solo', () => sql("select count(*) from socios where nombre='Finca Los Olivos CB'") === '1')
await esperarQue('el indicador desaparece', async () => (await a.getByText('Sin conexión').count()) === 0 && (await a.getByText('sin enviar').count()) === 0)

// --- Cambios hechos en el servidor llegan al móvil ---
sql("update socios set telefono = '950 12 34 56' where codigo = '0002'")
await a.goto(BASE + '/mas/sincronizacion')
await a.getByRole('button', { name: 'Sincronizar ahora' }).click()
await a.getByText('Todo al día').waitFor()
await a.goto(BASE + '/socios?q=nijar')
await a.getByText('1 socio encontrado').waitFor()
await a.getByText('Hortalizas Níjar SAT').click()
await a.getByText('950 12 34 56').waitFor()
comprobar('cambio del servidor visible en el móvil', true)

// --- Conflicto: código repetido creado sin conexión ---
await a.goto(BASE + '/socios')
await a.getByText('Hortalizas Níjar SAT').waitFor()
await ctxA.setOffline(true)
await a.getByRole('link', { name: 'Nuevo socio' }).click()
await a.getByLabel('Código de socio *').waitFor()
const codigoConflicto = await a.getByLabel('Código de socio *').inputValue()
await a.getByLabel('Nombre o razón social *').fill('Socio en conflicto')
await a.getByRole('button', { name: 'Dar de alta' }).click()
await a.waitForURL(/\/socios\/[0-9a-f-]{36}$/)
// Mientras tanto, otra persona da de alta ese mismo código en el servidor
sql(`insert into socios (codigo, nombre) values ('${codigoConflicto}', 'Alta desde la oficina')`)
await ctxA.setOffline(false)
await a.getByText('1 con error').waitFor({ timeout: 15000 })
await a.getByText('1 con error').click()
await a.getByRole('heading', { name: 'Cambios rechazados' }).waitFor()
await a.getByText('Ya existe un registro con ese código.').waitFor()
await a.screenshot({ path: `${OUT}/05-cambio-rechazado.png`, fullPage: true })
await a.getByRole('button', { name: 'Descartar' }).click()
await a.getByRole('dialog').getByRole('button', { name: 'Descartar' }).click()
await a.getByText('Todo al día').waitFor()
await a.goto(BASE + '/socios?estado=todos')
await a.getByText('Alta desde la oficina').waitFor()
comprobar('tras descartar, queda la versión del servidor', (await a.getByText('Socio en conflicto').count()) === 0)

// ===================== TÉCNICO =====================
const { ctx: ctxT, page: t } = await nuevoMovil()
await entrar(t, 'tecnico@op.es')
await t.goto(BASE + '/socios')
await t.getByText('Agrícola Pérez SL').waitFor()
comprobar('el técnico no ve «Nuevo socio»', (await t.getByRole('link', { name: 'Nuevo socio' }).count()) === 0)
await t.goto(BASE + '/socios/nuevo')
await t.waitForURL(BASE + '/socios')
comprobar('el técnico no puede abrir el alta', true)
await t.getByText('Agrícola Pérez SL').click()
comprobar('el técnico no ve «Eliminar socio»', (await t.getByRole('button', { name: 'Eliminar socio' }).count()) === 0)
await t.getByRole('link', { name: 'Editar' }).click()
await t.getByLabel('Notas sobre el socio').fill('Visita prevista la semana que viene.')
await t.getByRole('button', { name: 'Guardar cambios' }).click()
await t.getByText('Visita prevista la semana que viene.').waitFor()
await esperarQue('la edición del técnico llega a Supabase', () =>
  sql("select p.email from socios s join perfiles p on p.id = s.updated_by where s.codigo='0001' and s.observaciones like 'Visita%'") === 'tecnico@op.es',
)
await t.screenshot({ path: `${OUT}/06-tecnico-ficha.png`, fullPage: true })

// ===================== ELIMINAR (admin) =====================
await a.goto(BASE + '/socios')
await a.getByText('Finca Los Olivos CB').click()
await a.getByRole('button', { name: 'Eliminar socio' }).click()
await a.screenshot({ path: `${OUT}/07-confirmar-eliminar.png` })
await a.getByRole('dialog').getByRole('button', { name: 'Eliminar' }).click()
await a.waitForURL(BASE + '/socios')
await esperarQue('eliminado en Supabase (borrado lógico)', () => sql("select eliminado from socios where nombre='Finca Los Olivos CB'") === 't')
// El técnico lo deja de ver tras sincronizar
await t.goto(BASE + '/mas/sincronizacion')
await t.getByRole('button', { name: 'Sincronizar ahora' }).click()
await t.getByText('Todo al día').waitFor()
await t.goto(BASE + '/socios')
await t.getByText('Agrícola Pérez SL').waitFor()
comprobar('el técnico ya no ve el socio eliminado', (await t.getByText('Finca Los Olivos CB').count()) === 0)

// ===================== MUCHOS SOCIOS (paginación) =====================
sql(`insert into socios (codigo, nombre, localidad, estado)
     select 'M' || lpad(i::text, 5, '0'), 'Socio masivo ' || i, case when i % 3 = 0 then 'Roquetas de Mar' else 'La Mojonera' end,
            case when i % 10 = 0 then 'baja' else 'activo' end
     from generate_series(1, 2500) i`)
await t.goto(BASE + '/mas/sincronizacion')
await t.getByRole('button', { name: 'Sincronizar ahora' }).click()
await t.getByText('Todo al día').waitFor({ timeout: 30000 })
const totalServidor = sql('select count(*) from socios where not eliminado')
await t.getByText(`${Number(totalServidor).toLocaleString('es-ES')} socios ·`).waitFor({ timeout: 10000 }).then(
  () => comprobar(`descarga los ${totalServidor} socios, aunque compartan la misma hora`, true),
  async () => comprobar('descarga todos los socios', false, await t.locator('dd').nth(1).innerText()),
)
await t.goto(BASE + '/socios?q=masivo%20roquetas%2012')
await t.getByText('socios encontrados').waitFor()
const encontrados = await t.getByText('socios encontrados').innerText()
comprobar('búsqueda por varias palabras', /\d+ socios encontrados/.test(encontrados), encontrados)
await t.bringToFront()
await t.goto(BASE + '/socios')
await t.getByText('Agrícola Pérez SL').waitFor()
const filasIniciales = await t.locator('a[href^="/socios/"]').count()
await t.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await t.waitForTimeout(1000)
const filasTrasBajar = await t.locator('a[href^="/socios/"]').count()
comprobar('el listado va cargando al bajar', filasTrasBajar > filasIniciales, `${filasIniciales} → ${filasTrasBajar}`)
await t.screenshot({ path: `${OUT}/08-listado.png` })

// ===================== CERRAR SESIÓN CON CAMBIOS PENDIENTES =====================
await t.goto(BASE + '/socios?q=perez')
await t.getByText('Agrícola Pérez SL').waitFor()
await ctxT.setOffline(true)
await t.getByText('Agrícola Pérez SL').click()
await t.getByRole('link', { name: 'Editar' }).click()
await t.getByLabel('Teléfono').fill('611 22 33 44')
await t.getByRole('button', { name: 'Guardar cambios' }).click()
await t.getByText('Cambios sin enviar').waitFor()
await t.getByRole('link', { name: 'Más' }).click()
await t.getByRole('button', { name: 'Cerrar sesión' }).click()
await t.getByText('Tienes cambios sin enviar').waitFor()
await t.screenshot({ path: `${OUT}/09-aviso-cerrar-sesion.png` })
await t.getByRole('button', { name: 'No cerrar sesión' }).click()
await ctxT.setOffline(false)
await esperarQue('el cambio pendiente se envía al volver la red', () => sql("select telefono from socios where codigo='0001'") === '611 22 33 44')

// ===================== ORDENADOR =====================
const pc = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-ES', serviceWorkers: 'block' })
const q = await pc.newPage()
q.on('pageerror', (e) => errores.push('pageerror pc: ' + e.message))
await entrar(q, 'admin@op.es')
await q.goto(BASE + '/socios')
await q.getByText('Agrícola Pérez SL').waitFor({ timeout: 30000 })
await q.screenshot({ path: `${OUT}/10-socios-ordenador.png` })
await q.goto(BASE + '/')
await q.getByText('Socios activos').waitFor()
await q.screenshot({ path: `${OUT}/11-inicio-ordenador.png` })

// Sin desbordamiento horizontal a 320 px
const estrecho = await browser.newContext({ viewport: { width: 320, height: 640 }, locale: 'es-ES', serviceWorkers: 'block' })
const r = await estrecho.newPage()
await entrar(r, 'admin@op.es')
await r.goto(BASE + '/socios')
await r.getByText('Agrícola Pérez SL').waitFor({ timeout: 30000 })
const idPerez = sql("select id from socios where codigo='0001'")
for (const ruta of ['/socios', `/socios/${idPerez}`, `/socios/${idPerez}/editar`, '/socios/nuevo', '/mas/sincronizacion', '/mas']) {
  await r.goto(BASE + ruta)
  await r.waitForTimeout(700)
  const ancho = await r.evaluate(() => document.documentElement.scrollWidth)
  if (ancho > 320) errores.push(`desborde horizontal en ${ruta}: ${ancho}px`)
}

await browser.close()
console.log(errores.length ? '\nERRORES DE NAVEGADOR:\n' + errores.join('\n') : '\nSin errores de navegador')
console.log(fallos ? `\n${fallos} COMPROBACIONES FALLIDAS` : '\nTodas las comprobaciones correctas')
process.exit(fallos || errores.length ? 1 : 0)
