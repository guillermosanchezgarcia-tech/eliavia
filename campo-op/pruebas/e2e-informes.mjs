// Prueba de extremo a extremo de los informes (parte 6) contra un Supabase local
// real: totales por cultivo, municipio, certificación y tipo, filtros, enlaces a
// la lista de fincas y exportación a Excel (se abre el .xlsx descargado y se
// comprueba su contenido).
//
// Cómo ejecutarla: ver pruebas/README.md.
//   node pruebas/e2e-informes.mjs [carpeta-para-capturas]

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { strFromU8, unzipSync } from 'fflate'

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

// ---- Datos de la prueba ---------------------------------------------------------
// Activos: 001 Agrícola Pérez SL y 003 Marta Ruiz. De baja: 002 José López.
// Tomate se escribe de tres formas distintas a propósito.
sql(`
insert into public.socios (id, codigo, nombre, nif, telefono, email, estado, fecha_alta) values
  ('00000000-0000-0000-0000-000000000001', '001', 'Agrícola Pérez SL', 'B04123456', '600123456', 'perez@ejemplo.es', 'activo', '2020-01-15'),
  ('00000000-0000-0000-0000-000000000002', '002', 'José López', '27123456K', '950123456', null, 'baja', '2018-03-01'),
  ('00000000-0000-0000-0000-000000000003', '003', 'Marta Ruiz', '75123456M', null, null, 'activo', '2022-09-01');
insert into public.fincas (socio_id, nombre, provincia, municipio, tipo, tipo_invernadero, superficie_ha, cultivo, campana, certificaciones, fecha_ultima_visita) values
  ('00000000-0000-0000-0000-000000000001', 'La Loma',    4, 104, 'invernadero', 'raspa_amagado', 1.5,  'Tomate',   '2025/2026', '{GlobalG.A.P.,GRASP}', '2026-10-07'),
  ('00000000-0000-0000-0000-000000000001', 'El Cerro',   4, 104, 'invernadero', 'multitunel',    0.3,  'tomate',   '2025/2026', '{globalg.a.p.}', null),
  ('00000000-0000-0000-0000-000000000003', 'Balsa',      4, 104, 'aire_libre',  null,            0.2,  'Tomate ',  '2024/2025', '{}', null),
  ('00000000-0000-0000-0000-000000000003', 'Pimentera',  4,  66, 'invernadero', 'plano',         2,    'Pimiento', '2025/2026', '{}', null),
  ('00000000-0000-0000-0000-000000000002', 'La Hoya',    4,  66, 'invernadero', 'plano',         10,   'Pepino',   '2025/2026', '{GRASP}', null),
  ('00000000-0000-0000-0000-000000000003', 'Sin datos',  4, null, null,         null,            null, null,       null,        '{}', null);
`)

const errores = []
const browser = await chromium.launch()

async function nuevoMovil() {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'es-ES', serviceWorkers: 'block', acceptDownloads: true })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errores.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push('console: ' + m.text())
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

/** Pulsa «Excel», recoge la descarga y devuelve el nombre y las hojas del archivo. */
async function descargarYAbrir(page) {
  const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: 'Excel' }).click()])
  const ruta = await descarga.path()
  const archivo = unzipSync(new Uint8Array(readFileSync(ruta)))
  const texto = (nombre) => (archivo[nombre] ? strFromU8(archivo[nombre]) : '')
  const libro = texto('xl/workbook.xml')
  const nombres = [...libro.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map((m) => m[1].replaceAll('&amp;', '&'))
  const compartidas = [...texto('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''),
  )
  /** Filas de una hoja como listas de valores (texto o número); las celdas vacías quedan en null. */
  const columna = (ref) => [...ref.replace(/\d+/g, '')].reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0) - 1
  const hoja = (i) => {
    const xml = texto(`xl/worksheets/sheet${i + 1}.xml`)
    return [...xml.matchAll(/<row [^>]*>([\s\S]*?)<\/row>/g)].map((fila) => {
      const celdas = []
      for (const c of fila[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const atributos = c[1]
        const valor = /<v>([\s\S]*?)<\/v>/.exec(c[2] ?? '')?.[1]
        const enLinea = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(c[2] ?? '')?.[1]
        let v = null
        if (enLinea !== undefined) v = enLinea
        else if (valor !== undefined) v = /t="s"/.test(atributos) ? compartidas[Number(valor)] : Number(valor)
        celdas[columna(/r="([A-Z]+\d+)"/.exec(atributos)[1])] = v
      }
      return Array.from(celdas, (v) => v ?? null)
    })
  }
  return { nombreArchivo: descarga.suggestedFilename(), nombres, hoja }
}

const filas = async (page) => (await page.locator('main a[href^="/fincas?"]').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim())
const cifra = async (page, texto) => (await page.getByRole('region', { name: 'Resumen' }).getByText(texto, { exact: true }).locator('xpath=preceding-sibling::p[1]').innerText()).trim()

try {
  // ===== 1. Administrador: informe con los socios activos =====================
  const admin = await nuevoMovil()
  let page = admin.page
  await entrar(page, 'admin@op.es')

  // Inicio: mismas cifras que el informe (sin los socios de baja)
  await esperarQue('Inicio: 5 fincas y 4 hectáreas', async () => {
    const t = await page.locator('#titulo-resumen + div').innerText()
    return /5\s+Fincas/.test(t) && /\b4\s+Hectáreas/.test(t) ? true : t.replace(/\s+/g, ' ')
  })
  await page.getByRole('link', { name: /Informes/ }).click()
  await page.waitForURL('**/informes')
  await page.getByRole('heading', { name: 'Informes' }).waitFor()
  await page.getByRole('region', { name: 'Resumen' }).waitFor()

  comprobar('Informes: 2 socios', (await cifra(page, 'Socios')) === '2')
  comprobar('Informes: 5 fincas', (await cifra(page, 'Fincas')) === '5')
  comprobar('Informes: 4 hectáreas', (await cifra(page, 'Hectáreas')) === '4')
  comprobar('Informes: avisa de la finca sin superficie', await page.getByText('1 finca no tiene la superficie indicada').isVisible())
  await page.screenshot({ path: `${OUT}/i01-informe-cultivo.png`, fullPage: true })

  // Por cultivo: «Tomate», «tomate» y «Tomate » son el mismo
  let f = await filas(page)
  comprobar('Cultivo: tomate agrupado (3 fincas, 2 socios, 2,00 ha)', f.some((t) => /^Tomate\b.*2 ha.*3 fincas.*2 socios/.test(t)), f.join(' | '))
  comprobar('Cultivo: pimiento y «sin cultivo»', f.some((t) => /^Pimiento.*1 finca/.test(t)) && f.some((t) => /^Sin cultivo indicado.*1 finca/.test(t)))
  comprobar('Cultivo: el pepino de un socio de baja no cuenta', !f.some((t) => t.startsWith('Pepino')))
  comprobar('Cultivo: solo hay un «Tomate»', f.filter((t) => /^tomate/i.test(t)).length === 1)

  // Por municipio
  await page.getByRole('radio', { name: 'Municipio' }).click()
  await esperarQue('Municipio: El Ejido 3 fincas, Níjar 1, sin municipio 1', async () => {
    f = await filas(page)
    return f.some((t) => /^El Ejido.*3 fincas/.test(t)) && f.some((t) => /^Níjar.*1 finca/.test(t)) && f.some((t) => /^Sin municipio.*1 finca/.test(t)) ? true : f.join(' | ')
  })

  // Por certificación
  await page.getByRole('radio', { name: 'Certificación' }).click()
  await esperarQue('Certificación: GlobalG.A.P. 2 fincas (también la escrita en minúsculas)', async () => {
    f = await filas(page)
    return f.some((t) => /^GlobalG\.A\.P\..*2 fincas/.test(t)) ? true : f.join(' | ')
  })
  comprobar('Certificación: GRASP 1 finca y 3 sin certificación', f.some((t) => /^GRASP.*1 finca/.test(t)) && f.some((t) => /^Sin certificación.*3 fincas/.test(t)), f.join(' | '))
  comprobar('Certificación: explica que las filas no suman el total', await page.getByText('cuenta en cada una de ellas').isVisible())

  // Por tipo
  await page.getByRole('radio', { name: 'Tipo' }).click()
  await esperarQue('Tipo: invernadero 3, aire libre 1, sin tipo 1', async () => {
    f = await filas(page)
    return f.some((t) => /^Invernadero.*3 fincas/.test(t)) && f.some((t) => /^Aire libre.*1 finca/.test(t)) && f.some((t) => /^Sin tipo indicado.*1 finca/.test(t)) ? true : f.join(' | ')
  })

  // Incluir socios de baja
  await page.getByRole('radio', { name: 'Cultivo' }).click()
  await page.getByRole('checkbox', { name: 'Incluir socios de baja' }).click()
  await esperarQue('Con los de baja: 6 fincas y 14 ha', async () => ((await cifra(page, 'Fincas')) === '6' && (await cifra(page, 'Hectáreas')) === '14' ? true : await cifra(page, 'Fincas')))
  await esperarQue('Con los de baja aparece el pepino (10 ha, el primero)', async () => {
    f = await filas(page)
    return /^Pepino.*10 ha/.test(f[0] ?? '') ? true : f[0]
  })
  comprobar('Con los de baja: 3 socios', (await cifra(page, 'Socios')) === '3')

  // Campaña
  await page.getByLabel('Campaña').selectOption('2025/2026')
  await esperarQue('Campaña 2025/2026: 4 fincas', async () => ((await cifra(page, 'Fincas')) === '4' ? true : await cifra(page, 'Fincas')))
  comprobar('El desplegable de campañas ofrece la más reciente primero y las fincas sin campaña',
    JSON.stringify(await page.getByLabel('Campaña').locator('option').allInnerTexts()) ===
      JSON.stringify(['Todas', '2025/2026 (4)', '2024/2025 (1)', 'Sin campaña (1)']),
    JSON.stringify(await page.getByLabel('Campaña').locator('option').allInnerTexts()))
  comprobar('El filtro queda en la dirección', page.url().includes('campana=2025%2F2026') && page.url().includes('bajas=1'), page.url())
  await page.getByLabel('Campaña').selectOption('')

  // Exportar el informe (solo socios activos, todas las campañas)
  await page.getByRole('checkbox', { name: 'Incluir socios de baja' }).click()
  await esperarQue('Vuelven las 5 fincas', async () => ((await cifra(page, 'Fincas')) === '5' ? true : await cifra(page, 'Fincas')))
  let xlsx = await descargarYAbrir(page)
  comprobar('Excel del informe: nombre del archivo', /^informe-.+-\d{4}-\d{2}-\d{2}\.xlsx$/.test(xlsx.nombreArchivo), xlsx.nombreArchivo)
  comprobar('Excel del informe: hojas', JSON.stringify(xlsx.nombres) === JSON.stringify(['Resumen', 'Por cultivo', 'Por municipio', 'Por certificación', 'Por tipo de finca', 'Detalle de fincas']), xlsx.nombres.join(', '))
  const porCultivo = xlsx.hoja(1)
  const tomate = porCultivo.find((r) => r[0] === 'Tomate')
  comprobar('Excel: fila de Tomate (3 fincas, 2 socios, 2 ha)', tomate && tomate[1] === 3 && tomate[2] === 2 && tomate[3] === 2, JSON.stringify(tomate))
  comprobar('Excel: fila de total', JSON.stringify(porCultivo.at(-1)?.filter((v) => v !== null)) === JSON.stringify(['Total', 5, 2, 4, 1]), JSON.stringify(porCultivo.at(-1)))
  comprobar('Excel: fila «sin cultivo»', porCultivo.some((r) => r[0] === 'Sin cultivo indicado' && r[1] === 1))
  const detalle = xlsx.hoja(5)
  comprobar('Excel: detalle con una fila por finca', detalle.length === 6, `${detalle.length} filas`)
  const loma = detalle.find((r) => r[2] === 'La Loma')
  comprobar('Excel: La Loma con su socio, superficie y certificaciones', loma && loma[0] === '001' && loma[1] === 'Agrícola Pérez SL' && loma[5] === 1.5 && loma[6] === 15000 && loma[9] === 'GlobalG.A.P., GRASP', JSON.stringify(loma))
  comprobar('Excel: la última visita es una fecha de Excel (46302 = 07/10/2026)', loma && loma[10] === 46302, String(loma?.[10]))
  comprobar('Excel: el resumen dice quién lo ha generado', xlsx.hoja(0).flat().some((v) => typeof v === 'string' && v.includes('por Ana Martínez')))
  comprobar('Excel: el resumen anota «Solo socios activos»', xlsx.hoja(0).flat().includes('Solo socios activos'))

  // Entrar en una fila: la lista de fincas con las mismas condiciones
  await page.getByRole('link', { name: /^Tomate/ }).click()
  await page.waitForURL('**/fincas?**')
  await page.getByRole('heading', { name: 'Fincas' }).waitFor()
  comprobar('Al pulsar «Tomate» se abre la lista filtrada', page.url().includes('cultivo=Tomate') && page.url().includes('activos=1'), page.url())
  await esperarQue('La lista muestra las 3 fincas de tomate (2 ha)', async () => {
    const t = await page.locator('header').innerText()
    return /3 fincas · 2 ha/.test(t) ? true : t.replace(/\s+/g, ' ')
  })
  comprobar('Aparece el filtro «Solo socios activos»', await page.getByRole('button', { name: 'Quitar el filtro Solo socios activos' }).isVisible())
  await page.screenshot({ path: `${OUT}/i02-lista-filtrada.png` })

  // Excel de la lista filtrada
  xlsx = await descargarYAbrir(page)
  comprobar('Excel de fincas: nombre y hoja', /^fincas-.+\.xlsx$/.test(xlsx.nombreArchivo) && xlsx.nombres[0] === 'Fincas', `${xlsx.nombreArchivo} ${xlsx.nombres}`)
  const lista = xlsx.hoja(0)
  comprobar('Excel de fincas: solo las 3 de tomate', lista.length === 4 && lista.slice(1).map((r) => r[2]).sort().join() === 'Balsa,El Cerro,La Loma', lista.slice(1).map((r) => r[2]).join())

  // Filtros nuevos de la lista: campaña y desplegables sin duplicados
  await page.goto(BASE + '/fincas')
  await page.getByRole('button', { name: /^Filtros/ }).click()
  const cultivos = await page.getByRole('dialog').getByLabel('Cultivo').locator('option').allInnerTexts()
  comprobar('Lista de fincas: el desplegable de cultivos no repite el tomate', JSON.stringify(cultivos) === JSON.stringify(['Todos', 'Pepino (1)', 'Pimiento (1)', 'Tomate (3)', 'Sin cultivo indicado (1)']), JSON.stringify(cultivos))
  await page.getByRole('dialog').getByLabel('Campaña').selectOption('2024/2025')
  await page.getByRole('dialog').getByRole('button', { name: /^Ver 1 finca/ }).click()
  comprobar('Lista de fincas: filtro por campaña 2024/2025 deja Balsa', (await page.locator('main').innerText()).includes('Balsa') && !(await page.locator('main').innerText()).includes('La Loma'))
  await page.getByRole('button', { name: /^Filtros/ }).click()
  await page.getByRole('dialog').getByLabel('Campaña').selectOption('')
  await page.getByRole('dialog').getByRole('checkbox', { name: 'Solo fincas de socios activos' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^Ver 5 fincas/ }).click()
  comprobar('Lista de fincas: «solo socios activos» quita La Hoya', !(await page.locator('main').innerText()).includes('La Hoya'))

  // Socios: el administrador exporta la lista completa
  await page.goto(BASE + '/socios')
  await page.getByRole('radio', { name: /Todos/ }).click()
  xlsx = await descargarYAbrir(page)
  const socios = xlsx.hoja(0)
  comprobar('Excel de socios: 3 socios con NIF, teléfono, estado y fincas', socios.length === 4, `${socios.length} filas`)
  const perez = socios.find((r) => r[0] === '001')
  comprobar('Excel de socios: datos de Agrícola Pérez SL', perez && perez[1] === 'Agrícola Pérez SL' && perez[2] === 'B04123456' && perez[3] === '600123456' && perez[8] === 'Activo' && perez[11] === 2 && perez[12] === 1.8, JSON.stringify(perez))
  comprobar('Excel de socios: el de baja figura como «De baja»', socios.some((r) => r[1] === 'José López' && r[8] === 'De baja'))
  await admin.ctx.close()

  // ===== 2. Técnico: ve el informe y exporta, pero no la lista de socios ==========
  const tec = await nuevoMovil()
  page = tec.page
  await entrar(page, 'tecnico@op.es')
  await page.goto(BASE + '/informes')
  await page.getByRole('region', { name: 'Resumen' }).waitFor()
  await esperarQue('El técnico ve los mismos totales', async () => ((await cifra(page, 'Fincas')) === '5' ? true : await cifra(page, 'Fincas')))
  xlsx = await descargarYAbrir(page)
  comprobar('El técnico puede exportar el informe', xlsx.nombres.length === 6)
  const datosSocio = xlsx.hoja(5).flat().filter((v) => typeof v === 'string')
  comprobar('El informe no lleva NIF ni teléfonos de los socios', !datosSocio.some((v) => /B04123456|600123456/.test(v)))
  await page.goto(BASE + '/socios')
  await page.getByText('Agrícola Pérez SL').waitFor()
  comprobar('El técnico no ve el botón de exportar socios', (await page.getByRole('button', { name: 'Excel' }).count()) === 0)
  await page.goto(BASE + '/mas')
  comprobar('Más tiene el acceso a Informes y Excel', await page.getByRole('link', { name: /Informes y Excel/ }).isVisible())
  await tec.ctx.close()

  // ===== 3. Sin conexión: los totales salen de los datos guardados en el móvil =====
  const off = await nuevoMovil()
  page = off.page
  await entrar(page, 'admin@op.es')
  await page.getByRole('link', { name: /Informes/ }).click()
  await page.getByRole('region', { name: 'Resumen' }).waitFor()
  await off.ctx.setOffline(true)
  await page.getByRole('radio', { name: 'Municipio' }).click()
  f = await filas(page)
  comprobar('Sin conexión: los totales siguen funcionando', f.some((t) => /^El Ejido.*3 fincas/.test(t)), f.join(' | '))
  await off.ctx.close()

  // ===== 4. Sin datos =========================================================
  sql('truncate public.fotos, public.recintos, public.fincas, public.socios cascade;')
  const vacio = await nuevoMovil()
  page = vacio.page
  await entrar(page, 'admin@op.es')
  await page.goto(BASE + '/informes')
  await page.getByText('Todavía no hay datos para el informe').waitFor({ timeout: 20000 })
  comprobar('Sin fincas: mensaje claro en lugar de un informe vacío', true)
  comprobar('Sin fincas no se ofrece exportar', (await page.getByRole('button', { name: 'Excel' }).count()) === 0)
  await vacio.ctx.close()
} finally {
  await browser.close()
}

if (errores.length) {
  console.log('\nErrores de navegador:\n' + errores.join('\n'))
  fallos++
}
console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)` : '\nTodo correcto')
process.exit(fallos ? 1 : 0)
