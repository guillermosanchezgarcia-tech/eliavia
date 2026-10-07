import { Hammer, type LucideIcon } from 'lucide-react'
import { Cabecera, Contenido } from '../components/Layout'
import { Tarjeta, Vacio } from '../components/ui'

/** Pantalla provisional para las secciones que se construyen en las próximas partes. */
export function EnConstruccion({ titulo, icono = Hammer, parte, puntos }: {
  titulo: string
  icono?: LucideIcon
  parte: number
  puntos: string[]
}) {
  return (
    <>
      <Cabecera titulo={titulo} />
      <Contenido>
        <Tarjeta>
          <Vacio icono={icono} titulo="Sección en construcción">
            <p>
              Esta sección llega en la <strong>parte {parte}</strong>. Incluirá:
            </p>
            <ul className="mt-3 space-y-1.5 text-left">
              {puntos.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-marca-600" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </Vacio>
        </Tarjeta>
      </Contenido>
    </>
  )
}
