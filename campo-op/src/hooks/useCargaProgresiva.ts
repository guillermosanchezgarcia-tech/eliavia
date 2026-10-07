import { useCallback, useState } from 'react'

/**
 * Pinta los listados largos por tandas: al acercarse al final se muestran más
 * filas. `reinicio` cambia cuando cambia la búsqueda o el filtro, y vuelve a
 * empezar por arriba.
 */
export function useCargaProgresiva(reinicio: string, tanda = 60) {
  const [visibles, setVisibles] = useState(tanda)
  const [claveActual, setClaveActual] = useState(reinicio)
  if (claveActual !== reinicio) {
    setClaveActual(reinicio)
    setVisibles(tanda)
  }

  // Marca invisible al final de la lista. Se vuelve a crear en cada tanda para
  // que, si sigue a la vista (pantallas grandes), se pidan más enseguida.
  const centinela = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return
      const observador = new IntersectionObserver(
        (entradas) => {
          if (entradas.some((e) => e.isIntersecting)) setVisibles((v) => v + tanda)
        },
        { rootMargin: '600px 0px' },
      )
      observador.observe(el)
      return () => observador.disconnect()
    },
    [tanda],
  )

  return { visibles, centinela }
}
