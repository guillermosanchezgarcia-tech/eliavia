import { ArrowLeft, Send } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Aviso, Boton, Campo } from '../../components/ui'
import { mensajeDeError } from '../../lib/errores'
import { supabase } from '../../lib/supabase'
import { PantallaAcceso } from './PantallaAcceso'

export function RecuperarClave() {
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nueva-clave`,
    })
    setEnviando(false)
    if (error) setError(mensajeDeError(error))
    else setEnviado(true)
  }

  return (
    <PantallaAcceso
      titulo="Recuperar contraseña"
      subtitulo="Te enviaremos un enlace a tu email para que elijas una contraseña nueva."
    >
      {enviado ? (
        <Aviso tipo="exito" titulo="Revisa tu correo">
          Si <strong>{email}</strong> tiene cuenta en la app, recibirás un email en unos minutos. Mira también en la
          carpeta de spam.
        </Aviso>
      ) : (
        <form onSubmit={enviar} className="space-y-4" noValidate>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Campo
            etiqueta="Email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@ejemplo.es"
          />
          <Boton type="submit" icono={Send} cargando={enviando} disabled={!email.includes('@')} bloque>
            Enviar enlace
          </Boton>
        </form>
      )}
      <p className="pt-6 text-center">
        <Link to="/login" className="inline-flex items-center gap-1.5 py-2 text-sm font-medium text-marca-800 hover:underline">
          <ArrowLeft className="size-4" aria-hidden />
          Volver a entrar
        </Link>
      </p>
    </PantallaAcceso>
  )
}
