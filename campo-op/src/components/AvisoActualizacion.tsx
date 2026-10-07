import { RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Boton } from './ui'

const UNA_HORA = 60 * 60 * 1000

/**
 * Cuando se publica una versión nueva de la app, aparece este aviso. El
 * usuario elige cuándo actualizar para no perder lo que esté escribiendo.
 */
export function AvisoActualizacion() {
  const {
    needRefresh: [hayVersionNueva, setHayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      // Comprueba si hay versión nueva cada hora mientras la app está abierta.
      if (registro) setInterval(() => void registro.update(), UNA_HORA)
    },
  })

  if (!hayVersionNueva) return null

  return (
    <div className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md lg:bottom-6">
      <div className="flex items-center gap-3 rounded-2xl bg-stone-900 p-3 pl-4 text-white shadow-lg">
        <RefreshCw className="size-5 shrink-0 text-marca-300" aria-hidden />
        <p className="flex-1 text-sm">Hay una versión nueva de la app.</p>
        <button
          type="button"
          onClick={() => setHayVersionNueva(false)}
          className="min-h-11 rounded-lg px-2 text-sm text-stone-300 hover:text-white"
        >
          Luego
        </button>
        <Boton className="min-h-11 bg-marca-600 px-3 text-sm" onClick={() => void updateServiceWorker(true)}>
          Actualizar
        </Boton>
      </div>
    </div>
  )
}
