// Crea el archivo de Excel y lo entrega al usuario: descarga en el móvil o el ordenador,
// o la hoja de «Compartir» en el iPhone (donde las descargas desde una app instalada no funcionan bien).

import type { HojaExcel } from './exportar'
import { esIOS } from './instalacion'

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export type ResultadoDescarga = 'descargado' | 'compartido' | 'cancelado'

/** Genera el .xlsx. La librería (unos 70 KB) solo se descarga la primera vez que se exporta. */
export async function crearExcel(hojas: HojaExcel[]): Promise<Blob> {
  const { default: escribir } = await import('write-excel-file/browser')
  return escribir(hojas, { fontFamily: 'Calibri', fontSize: 11 }).toBlob()
}

function guardarComoArchivo(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.rel = 'noopener'
  document.body.append(enlace)
  enlace.click()
  enlace.remove()
  // Se libera un poco después: algunos navegadores empiezan la descarga de forma asíncrona.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Crea el Excel con las hojas dadas y lo descarga (o lo comparte, en iPhone/iPad). */
export async function descargarExcel(nombreArchivo: string, hojas: HojaExcel[]): Promise<ResultadoDescarga> {
  const nombre = nombreArchivo.endsWith('.xlsx') ? nombreArchivo : `${nombreArchivo}.xlsx`
  const blob = await crearExcel(hojas)

  if (esIOS() && typeof File !== 'undefined' && typeof navigator.canShare === 'function') {
    const archivo = new File([blob], nombre, { type: TIPO_XLSX })
    if (navigator.canShare({ files: [archivo] })) {
      try {
        await navigator.share({ files: [archivo], title: nombre })
        return 'compartido'
      } catch (e) {
        // Si la persona cierra la hoja de compartir no es un error.
        if (e instanceof DOMException && e.name === 'AbortError') return 'cancelado'
        // Cualquier otro fallo: se intenta la descarga normal.
      }
    }
  }

  guardarComoArchivo(blob, nombre)
  return 'descargado'
}
