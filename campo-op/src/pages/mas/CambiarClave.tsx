import { KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/contexto'
import { Cabecera, Contenido } from '../../components/Layout'
import { Aviso, Boton, Campo, Tarjeta } from '../../components/ui'
import { mensajeDeError } from '../../lib/errores'
import { supabase } from '../../lib/supabase'

const MINIMO = 8

/**
 * Cambiar la contraseña. Se usa desde «Más → Cambiar contraseña» y también al
 * llegar desde el email de «He olvidado mi contraseña».
 */
export function CambiarClave() {
  const { recuperandoClave, terminarRecuperacion } = useAuth()
  const navegar = useNavigate()
  const [clave, setClave] = useState('')
  const [repetida, setRepetida] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState(false)

  const errorLongitud = clave && clave.length < MINIMO ? `Debe tener al menos ${MINIMO} caracteres.` : null
  const errorRepetida = repetida && repetida !== clave ? 'Las dos contraseñas no coinciden.' : null
  const valido = clave.length >= MINIMO && clave === repetida

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!valido) return
    setError(null)
    setGuardando(true)
    const { error } = await supabase.auth.updateUser({ password: clave })
    setGuardando(false)
    if (error) {
      setError(mensajeDeError(error))
      return
    }
    setHecho(true)
    terminarRecuperacion()
  }

  return (
    <>
      <Cabecera titulo={recuperandoClave ? 'Elige una contraseña nueva' : 'Cambiar contraseña'} atras={recuperandoClave ? undefined : '/mas'} />
      <Contenido>
        {hecho ? (
          <div className="space-y-4">
            <Aviso tipo="exito" titulo="Contraseña cambiada">
              A partir de ahora entra con tu contraseña nueva.
            </Aviso>
            <Boton bloque onClick={() => navegar('/', { replace: true })}>
              Ir al inicio
            </Boton>
          </div>
        ) : (
          <Tarjeta className="p-4 sm:p-6">
            <form onSubmit={guardar} className="space-y-4" noValidate>
              {error && <Aviso tipo="error">{error}</Aviso>}
              <Campo
                etiqueta="Contraseña nueva"
                type="password"
                autoComplete="new-password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                error={errorLongitud}
                ayuda={`Mínimo ${MINIMO} caracteres. Mejor si mezclas letras y números.`}
              />
              <Campo
                etiqueta="Repite la contraseña"
                type="password"
                autoComplete="new-password"
                value={repetida}
                onChange={(e) => setRepetida(e.target.value)}
                error={errorRepetida}
              />
              <Boton type="submit" icono={KeyRound} cargando={guardando} disabled={!valido} bloque>
                Guardar contraseña
              </Boton>
            </form>
          </Tarjeta>
        )}
      </Contenido>
    </>
  )
}
