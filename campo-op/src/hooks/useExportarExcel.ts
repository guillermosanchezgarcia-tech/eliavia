import { useCallback, useState } from 'react'
import { descargarExcel } from '../lib/descargar'
import type { HojaExcel } from '../lib/exportar'

/** Estado de una exportación a Excel: si está en marcha y si ha fallado. */
export function useExportarExcel() {
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportar = useCallback(async (nombreArchivo: string, crearHojas: () => HojaExcel[]) => {
    setExportando(true)
    setError(null)
    try {
      await descargarExcel(nombreArchivo, crearHojas())
    } catch {
      setError('No se ha podido crear el archivo de Excel. Inténtalo de nuevo.')
    } finally {
      setExportando(false)
    }
  }, [])

  const cerrarError = useCallback(() => setError(null), [])

  return { exportar, exportando, error, cerrarError }
}
