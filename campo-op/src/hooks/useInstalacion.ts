import { useSyncExternalStore } from 'react'
import { puedeInstalarse, suscribirInstalacion } from '../lib/instalacion'

/** true cuando el navegador ofrece instalar la app (Android, Chrome, Edge). */
export function useInstalacion(): boolean {
  return useSyncExternalStore(suscribirInstalacion, puedeInstalarse, () => false)
}
