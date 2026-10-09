// Zonas del mapa descargadas para trabajar sin cobertura (parte 4).
//
// · Las imágenes (ortofoto PNOA y recintos SIGPAC) se guardan en el almacén
//   de caché del navegador, una caja por zona: «campo-op-zona-<id>».
// · Lo que es cada zona (nombre, rectángulos, tamaño…) se apunta en la base
//   de datos del móvil (tabla `zonas`).
// · Al pintar el mapa, cada tesela se busca primero en las zonas descargadas;
//   si está, se usa sin pedir nada a internet (ver capas.ts).
//
// Solo se descarga una zona a la vez. La descarga sigue aunque se cambie de
// pantalla dentro de la app; si se cierra la app o se pierde la cobertura,
// la zona queda «incompleta» y se puede terminar después sin repetir lo hecho.

import { useSyncExternalStore } from 'react'
import { db, type ZonaMapa } from '../datos/db'
import { planificar, urlOrtofoto, urlSigpac, type Area, type Tesela } from './teselas'

const PREFIJO = 'campo-op-zona-'
const SIMULTANEAS = 6
const REINTENTOS = 2

const hayCaches = () => typeof caches !== 'undefined'

// ---- Buscar teselas descargadas ---------------------------------------------

let cajas: Cache[] | null = null
let cargandoCajas: Promise<Cache[]> | null = null

async function abrirCajas(): Promise<Cache[]> {
  if (cajas) return cajas
  if (!hayCaches()) return (cajas = [])
  cargandoCajas ??= (async () => {
    const nombres = (await caches.keys()).filter((n) => n.startsWith(PREFIJO))
    cajas = await Promise.all(nombres.map((n) => caches.open(n)))
    cargandoCajas = null
    return cajas
  })()
  return cargandoCajas
}

/** Hay que volver a mirar qué cajas existen (se ha creado o borrado una zona). */
function olvidarCajas() {
  cajas = null
}

/** Busca una tesela en las zonas descargadas. Devuelve la imagen o `null`. */
export async function buscarTesela(url: string): Promise<Blob | null> {
  try {
    const lista = await abrirCajas()
    for (const c of lista) {
      const r = await c.match(url)
      if (r) return await r.blob()
    }
  } catch {
    // Si el almacén falla, el mapa simplemente pide la tesela a internet.
  }
  return null
}

// ---- Estado de la descarga en curso (para enseñarlo en pantalla) -----------

export interface Progreso {
  zonaId: string
  nombre: string
  hechas: number
  total: number
  fallidas: number
  bytes: number
  cancelando: boolean
}

let progreso: Progreso | null = null
let ultimoAviso: { zonaId: string; texto: string; tipo: 'exito' | 'aviso' } | null = null
const oyentes = new Set<() => void>()
let controlador: AbortController | null = null

function avisar() {
  for (const o of oyentes) o()
}
function suscribir(o: () => void) {
  oyentes.add(o)
  return () => oyentes.delete(o)
}

/** Descarga en curso (o `null`). Se actualiza unas pocas veces por segundo. */
export function useDescarga(): Progreso | null {
  return useSyncExternalStore(suscribir, () => progreso, () => null)
}

/** Resultado de la última descarga terminada (para el aviso de «lista»). */
export function useUltimoAviso() {
  return useSyncExternalStore(suscribir, () => ultimoAviso, () => null)
}

export function olvidarAviso() {
  ultimoAviso = null
  avisar()
}

// ---- Crear, descargar y borrar ------------------------------------------------

export interface NuevaZona {
  nombre: string
  tipo: ZonaMapa['tipo']
  areas: Area[]
  detalle: number
}

/** Crea la zona y empieza a descargarla. Devuelve su id. */
export async function crearZona(nueva: NuevaZona): Promise<string> {
  if (progreso) throw new Error('Ya hay una zona descargándose. Espera a que termine o cancélala.')
  const plan = planificar(nueva.areas)
  const ahora = new Date().toISOString()
  const zona: ZonaMapa = {
    id: crypto.randomUUID(),
    nombre: nueva.nombre.trim() || 'Zona sin nombre',
    tipo: nueva.tipo,
    areas: nueva.areas,
    detalle: nueva.detalle,
    teselas: plan.total,
    descargadas: 0,
    fallidas: 0,
    bytes: 0,
    estado: 'descargando',
    creada: ahora,
    actualizada: ahora,
  }
  await db.zonas.put(zona)
  void pedirAlmacenamientoPersistente()
  void descargar(zona)
  return zona.id
}

/**
 * Vuelve a intentar lo que faltó de una zona (lo ya descargado no se repite).
 * Con `areas` nuevas (p. ej. las fincas dadas de alta después), descarga lo que falte de ellas.
 */
export async function completarZona(id: string, areas?: Area[]) {
  if (progreso) throw new Error('Ya hay una zona descargándose. Espera a que termine o cancélala.')
  const zona = await db.zonas.get(id)
  if (!zona) return
  const actualizada = areas ? { ...zona, areas } : zona
  if (areas) await db.zonas.update(id, { areas })
  void pedirAlmacenamientoPersistente()
  void descargar(actualizada)
}

export function cancelarDescarga() {
  if (!progreso || !controlador) return
  progreso = { ...progreso, cancelando: true }
  controlador.abort()
  avisar()
}

export async function borrarZona(id: string) {
  if (progreso?.zonaId === id) {
    cancelarDescarga()
    // Se espera a que la descarga se pare para no dejar restos.
    await new Promise<void>((listo) => {
      const quitar = suscribir(() => {
        if (!progreso) {
          quitar()
          listo()
        }
      })
    })
  }
  if (hayCaches()) await caches.delete(PREFIJO + id)
  olvidarCajas()
  await db.zonas.delete(id)
}

async function descargar(zona: ZonaMapa) {
  if (!hayCaches()) {
    await db.zonas.update(zona.id, { estado: 'incompleta' })
    ultimoAviso = { zonaId: zona.id, tipo: 'aviso', texto: 'Este navegador no permite guardar el mapa para usarlo sin conexión.' }
    avisar()
    return
  }

  const plan = planificar(zona.areas)
  const trabajos: { url: string }[] = [
    ...plan.ortofoto.map((t: Tesela) => ({ url: urlOrtofoto(t) })),
    ...plan.sigpac.map((t: Tesela) => ({ url: urlSigpac(t) })),
  ]
  const caja = await caches.open(PREFIJO + zona.id)
  olvidarCajas()

  controlador = new AbortController()
  const senal = controlador.signal
  progreso = { zonaId: zona.id, nombre: zona.nombre, hechas: 0, total: trabajos.length, fallidas: 0, bytes: 0, cancelando: false }
  avisar()
  await db.zonas.update(zona.id, { estado: 'descargando', teselas: trabajos.length })

  let hechas = 0
  let fallidas = 0
  let bytes = 0
  let sinRed = false
  let siguiente = 0
  let ultimoPintado = 0

  const pintar = (forzar = false) => {
    const ahora = Date.now()
    if (!forzar && ahora - ultimoPintado < 250) return
    ultimoPintado = ahora
    if (progreso) progreso = { ...progreso, hechas, fallidas, bytes }
    avisar()
  }

  async function una(url: string) {
    // ¿Ya estaba (de una descarga anterior a medias)?
    const ya = await caja.match(url)
    if (ya) {
      bytes += Number(ya.headers.get('content-length')) || (await ya.clone().blob()).size
      return true
    }
    for (let intento = 0; intento <= REINTENTOS; intento++) {
      if (senal.aborted) return false
      try {
        const r = await fetch(url, { mode: 'cors', signal: senal })
        if (!r.ok) {
          // 404: esa tesela no existe (p. ej. en el mar). No es un fallo.
          if (r.status === 404) return true
          throw new Error(`HTTP ${r.status}`)
        }
        const blob = await r.blob()
        await caja.put(url, new Response(blob, { headers: { 'content-type': blob.type, 'content-length': String(blob.size) } }))
        bytes += blob.size
        return true
      } catch (e) {
        if (senal.aborted) return false
        if (!navigator.onLine) {
          sinRed = true
          controlador?.abort()
          return false
        }
        if (e instanceof DOMException && e.name === 'QuotaExceededError') throw e
        await new Promise((r) => setTimeout(r, 400 * (intento + 1)))
      }
    }
    return false
  }

  let errorGrave: unknown = null
  async function trabajador() {
    while (!senal.aborted && siguiente < trabajos.length) {
      const { url } = trabajos[siguiente++]
      try {
        const bien = await una(url)
        if (senal.aborted && !bien) return
        if (bien) hechas++
        else fallidas++
      } catch (e) {
        errorGrave = e
        controlador?.abort()
        return
      }
      pintar()
    }
  }

  await Promise.all(Array.from({ length: SIMULTANEAS }, trabajador))

  const completa = hechas === trabajos.length
  await db.zonas.update(zona.id, {
    descargadas: hechas,
    fallidas: trabajos.length - hechas,
    bytes,
    estado: completa ? 'completa' : 'incompleta',
    actualizada: new Date().toISOString(),
  })

  let texto: string
  if (completa) texto = `«${zona.nombre}» ya se puede ver sin conexión.`
  else if (errorGrave) texto = 'El móvil no tiene más espacio. Borra alguna zona o elige menos detalle.'
  else if (sinRed) texto = 'Se ha perdido la conexión. Lo descargado se conserva: pulsa «Completar» cuando vuelva la cobertura.'
  else if (progreso?.cancelando) texto = 'Descarga cancelada. Lo descargado se conserva: puedes completarla después.'
  else texto = `Faltan ${trabajos.length - hechas} imágenes que no se pudieron descargar. Pulsa «Completar» para reintentarlo.`
  ultimoAviso = { zonaId: zona.id, texto, tipo: completa ? 'exito' : 'aviso' }

  progreso = null
  controlador = null
  olvidarCajas()
  avisar()
}

/** Al abrir la app, una zona que se quedó «descargando» (se cerró la app) pasa a «incompleta». */
export async function repararZonasInterrumpidas() {
  if (progreso) return
  await db.zonas.where('id').above('').modify((z) => {
    if (z.estado === 'descargando') z.estado = 'incompleta'
  })
}

// ---- Espacio del móvil -------------------------------------------------------------

/** Pide al navegador que no borre lo descargado aunque le falte espacio. */
export async function pedirAlmacenamientoPersistente(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function espacioDelMovil(): Promise<{ usado: number; disponible: number; persistente: boolean } | null> {
  try {
    if (!navigator.storage?.estimate) return null
    const { usage = 0, quota = 0 } = await navigator.storage.estimate()
    const persistente = (await navigator.storage.persisted?.()) ?? false
    return { usado: usage, disponible: Math.max(0, quota - usage), persistente }
  } catch {
    return null
  }
}
