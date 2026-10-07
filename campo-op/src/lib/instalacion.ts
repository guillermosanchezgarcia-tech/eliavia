// Gestiona el aviso «Instalar la app» de Android/Chrome. El navegador lanza el
// evento una sola vez y muy pronto, por eso se captura nada más arrancar.

interface EventoInstalacion extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let evento: EventoInstalacion | null = null
const oyentes = new Set<() => void>()
const avisar = () => oyentes.forEach((o) => o())

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  evento = e as EventoInstalacion
  avisar()
})

window.addEventListener('appinstalled', () => {
  evento = null
  avisar()
})

export function suscribirInstalacion(oyente: () => void) {
  oyentes.add(oyente)
  return () => {
    oyentes.delete(oyente)
  }
}

export function puedeInstalarse(): boolean {
  return evento !== null
}

export async function instalar(): Promise<boolean> {
  if (!evento) return false
  await evento.prompt()
  const { outcome } = await evento.userChoice
  evento = null
  avisar()
  return outcome === 'accepted'
}

export function estaInstalada(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function esIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
