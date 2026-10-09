import { Link } from 'react-router'
import { Aviso } from '../../components/ui'
import { PantallaAcceso } from './PantallaAcceso'

/** Se muestra si alguien abre el enlace de «nueva contraseña» caducado o ya usado. */
export function EnlaceNoValido() {
  return (
    <PantallaAcceso titulo="Enlace no válido">
      <Aviso tipo="aviso">
        El enlace para cambiar la contraseña ha caducado o ya se ha usado. Los enlaces solo sirven una vez y durante un
        tiempo limitado.
      </Aviso>
      <div className="mt-6 flex flex-col gap-2 text-center">
        <Link
          to="/recuperar"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-marca-700 px-4 font-semibold text-white hover:bg-marca-800"
        >
          Pedir un enlace nuevo
        </Link>
        <Link to="/login" className="py-3 text-sm font-medium text-marca-800 hover:underline">
          Volver a entrar
        </Link>
      </div>
    </PantallaAcceso>
  )
}
