import { useSyncExternalStore } from 'react'

function suscribir(aviso: () => void) {
  window.addEventListener('online', aviso)
  window.addEventListener('offline', aviso)
  return () => {
    window.removeEventListener('online', aviso)
    window.removeEventListener('offline', aviso)
  }
}

/** Devuelve true si el dispositivo tiene conexión a internet. */
export function useConexion(): boolean {
  return useSyncExternalStore(suscribir, () => navigator.onLine, () => true)
}
