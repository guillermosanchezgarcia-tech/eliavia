import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/contexto'
import { Aviso, Boton, Campo } from '../../components/ui'
import { useConexion } from '../../hooks/useConexion'
import { PantallaAcceso } from './PantallaAcceso'

export function Login() {
  const { iniciarSesion } = useAuth()
  const conexion = useConexion()
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function entrar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    const fallo = await iniciarSesion(email, clave)
    // Si ha ido bien, la app cambia sola a la pantalla de inicio.
    if (fallo) {
      setError(fallo)
      setEnviando(false)
    }
  }

  return (
    <PantallaAcceso titulo="Entrar" subtitulo="Accede con el email y la contraseña que te ha dado la OP.">
      <form onSubmit={entrar} className="space-y-4" noValidate>
        {!conexion && (
          <Aviso tipo="aviso" titulo="Sin conexión">
            Para entrar por primera vez en este dispositivo necesitas cobertura. Después podrás usar la app sin ella.
          </Aviso>
        )}
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Campo
          etiqueta="Email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nombre@ejemplo.es"
        />
        <Campo
          etiqueta="Contraseña"
          type={verClave ? 'text' : 'password'}
          autoComplete="current-password"
          required
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          accesorio={
            <button
              type="button"
              onClick={() => setVerClave((v) => !v)}
              className="grid size-11 place-items-center rounded-lg text-stone-500 hover:text-stone-800"
              aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {verClave ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
            </button>
          }
        />
        <Boton type="submit" icono={LogIn} cargando={enviando} disabled={!email || !clave} bloque>
          Entrar
        </Boton>
        <p className="pt-2 text-center">
          <Link to="/recuperar" className="inline-block py-2 text-sm font-medium text-marca-800 hover:underline">
            He olvidado mi contraseña
          </Link>
        </p>
      </form>
    </PantallaAcceso>
  )
}
