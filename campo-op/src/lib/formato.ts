// Funciones para mostrar datos: fechas, superficies, búsquedas sin tildes…

/** Pasa a minúsculas y quita tildes, para buscar sin preocuparse de ellas. */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** ¿El texto contiene todas las palabras buscadas (en cualquier orden)? */
export function coincide(texto: string, busqueda: string): boolean {
  const palabras = normalizar(busqueda).split(/\s+/).filter(Boolean)
  const donde = normalizar(texto)
  return palabras.every((p) => donde.includes(p))
}

/** «2026-10-07» → «07/10/2026». */
export function formatearFecha(fecha: string | null | undefined): string {
  if (!fecha) return ''
  const [a, m, d] = fecha.slice(0, 10).split('-')
  return d && m && a ? `${d}/${m}/${a}` : fecha
}

/** Fecha de hoy como «AAAA-MM-DD» (hora de España, no UTC). */
export function hoy(): string {
  const ahora = new Date()
  const desfase = ahora.getTimezoneOffset() * 60000
  return new Date(ahora.getTime() - desfase).toISOString().slice(0, 10)
}

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatearFechaHora(iso: string | null | undefined): string {
  if (!iso) return ''
  return FORMATO_FECHA_HORA.format(new Date(iso.replace(/(\.\d{3})\d+/, '$1')))
}

const RELATIVO = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

/** «hace 5 minutos», «ayer»… */
export function haceCuanto(iso: string | null | undefined, ahora = Date.now()): string {
  if (!iso) return 'nunca'
  const segundos = Math.round((Date.parse(iso.replace(/(\.\d{3})\d+/, '$1')) - ahora) / 1000)
  const abs = Math.abs(segundos)
  if (abs < 45) return 'ahora mismo'
  if (abs < 3600) return RELATIVO.format(Math.round(segundos / 60), 'minute')
  if (abs < 86400) return RELATIVO.format(Math.round(segundos / 3600), 'hour')
  return RELATIVO.format(Math.round(segundos / 86400), 'day')
}

const NUMERO = (decimales: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: decimales })

/** 1.23456 → «1,23 ha» */
export function formatearHa(ha: number | null | undefined, decimales = 2): string {
  if (ha === null || ha === undefined) return '—'
  return `${NUMERO(decimales).format(ha)} ha`
}

/** 1.2345 → «12.345 m²» */
export function formatearM2(ha: number | null | undefined): string {
  if (ha === null || ha === undefined) return '—'
  return `${NUMERO(0).format(Math.round(ha * 10000))} m²`
}

export function formatearNumero(n: number, decimales = 0): string {
  return NUMERO(decimales).format(n)
}

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'sl', 'sa', 'sat', 'scl', 'sca', 'slu', 'cb'])

/** «Agrícola Pérez SL» → «AP»; «José de la Torre» → «JT» */
export function iniciales(nombre: string): string {
  const palabras = nombre.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean)
  const utiles = palabras.filter((p) => !PARTICULAS.has(p.toLowerCase()))
  return (utiles.length ? utiles : palabras)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

/** Ordena textos como lo haría una persona: «2» antes que «10», sin tildes. */
export const comparar = new Intl.Collator('es', { numeric: true, sensitivity: 'base' }).compare

/** Lee un número escrito a la española: «1.234,5» o «1234,5» o «1234.5». Devuelve null si no es un número. */
export function parsearNumero(texto: string): number | null {
  const limpio = texto.trim().replace(/\s/g, '')
  if (!limpio) return null
  // Con coma decimal, los puntos son separadores de miles; sin coma, un punto es decimal.
  const normal = limpio.includes(',') ? limpio.replace(/\./g, '').replace(',', '.') : limpio
  if (!/^-?\d+(\.\d+)?$/.test(normal)) return null
  const n = Number(normal)
  return Number.isFinite(n) ? n : null
}

/** Número para escribir en un campo: 1.2345 → «1,2345» (sin separador de miles). */
export function numeroParaCampo(n: number | null | undefined, decimales = 4): string {
  if (n === null || n === undefined) return ''
  return String(Number(n.toFixed(decimales))).replace('.', ',')
}

export const HA_A_M2 = 10000

/** «hoy», «ayer», «hace 12 días», «hace 3 meses» a partir de una fecha «AAAA-MM-DD». */
export function haceDias(fecha: string | null | undefined, referencia = hoy()): string {
  if (!fecha) return ''
  const dias = Math.round((Date.parse(referencia) - Date.parse(fecha.slice(0, 10))) / 86400000)
  if (dias <= 0) return dias === 0 ? 'hoy' : 'en el futuro'
  if (dias === 1) return 'ayer'
  if (dias < 60) return `hace ${dias} días`
  if (dias < 730) return `hace ${Math.round(dias / 30)} meses`
  return `hace ${Math.round(dias / 365)} años`
}
