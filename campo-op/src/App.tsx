import { Map as IconoMapa, SearchX, Sprout } from 'lucide-react'
import type { ReactElement } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth, usePerfil } from './auth/contexto'
import { Cabecera, Contenido, Layout } from './components/Layout'
import { Tarjeta, Vacio } from './components/ui'
import { configurado } from './config'
import { EnlaceNoValido } from './pages/acceso/EnlaceNoValido'
import { Login } from './pages/acceso/Login'
import { RecuperarClave } from './pages/acceso/RecuperarClave'
import { EnConstruccion } from './pages/EnConstruccion'
import { ConfiguracionPendiente, CuentaDesactivada, PantallaCargando, PantallaError } from './pages/Estados'
import { Inicio } from './pages/Inicio'
import { CambiarClave } from './pages/mas/CambiarClave'
import { Mas } from './pages/mas/Mas'
import { Sincronizacion } from './pages/mas/Sincronizacion'
import { Usuarios } from './pages/mas/Usuarios'
import { FichaSocio } from './pages/socios/FichaSocio'
import { FormularioSocio } from './pages/socios/FormularioSocio'
import { ListaSocios } from './pages/socios/ListaSocios'

export default function App() {
  if (!configurado) return <ConfiguracionPendiente />
  return (
    <AuthProvider>
      <BrowserRouter>
        <Rutas />
      </BrowserRouter>
    </AuthProvider>
  )
}

/** Decide qué pantallas se pueden ver según haya sesión iniciada o no. */
function Rutas() {
  const { sesion, recuperandoClave } = useAuth()

  if (sesion.tipo === 'cargando') return <PantallaCargando />
  if (sesion.tipo === 'error') return <PantallaError mensaje={sesion.mensaje} />

  if (sesion.tipo === 'sin-sesion') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/recuperar" element={<RecuperarClave />} />
        <Route path="/nueva-clave" element={<EnlaceNoValido />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (!sesion.perfil.activo) return <CuentaDesactivada />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={recuperandoClave ? <Navigate to="/nueva-clave" replace /> : <Inicio />} />
        <Route path="socios" element={<ListaSocios />} />
        <Route path="socios/nuevo" element={<FormularioSocio />} />
        <Route path="socios/:id" element={<FichaSocio />} />
        <Route path="socios/:id/editar" element={<FormularioSocio />} />
        <Route
          path="fincas/*"
          element={
            <EnConstruccion
              titulo="Fincas"
              icono={Sprout}
              parte={3}
              puntos={[
                'Ficha de finca: tipo, superficie, cultivo, campaña y certificaciones',
                'Referencias SIGPAC con varios recintos',
                'Fotos, observaciones y fecha de la última visita',
              ]}
            />
          }
        />
        <Route
          path="mapa"
          element={
            <EnConstruccion
              titulo="Mapa"
              icono={IconoMapa}
              parte={5}
              puntos={[
                'Ortofoto PNOA y capa SIGPAC',
                'Buscar parcela por municipio, polígono y parcela',
                'Mi posición y su referencia SIGPAC',
                'Botón «Cómo llegar» con Google Maps',
              ]}
            />
          }
        />
        <Route path="mas" element={<Mas />} />
        <Route path="mas/clave" element={<CambiarClave />} />
        <Route path="mas/sincronizacion" element={<Sincronizacion />} />
        <Route path="nueva-clave" element={<CambiarClave />} />
        <Route
          path="mas/usuarios"
          element={
            <SoloAdmin>
              <Usuarios />
            </SoloAdmin>
          }
        />
        <Route path="login" element={<Navigate to="/" replace />} />
        <Route path="recuperar" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NoEncontrada />} />
      </Route>
    </Routes>
  )
}

function SoloAdmin({ children }: { children: ReactElement }) {
  const perfil = usePerfil()
  return perfil.rol === 'admin' ? children : <Navigate to="/" replace />
}

function NoEncontrada() {
  return (
    <>
      <Cabecera titulo="Página no encontrada" />
      <Contenido>
        <Tarjeta>
          <Vacio
            icono={SearchX}
            titulo="Esta página no existe"
            accion={
              <Link to="/" className="font-semibold text-marca-800 hover:underline">
                Ir al inicio
              </Link>
            }
          >
            Puede que el enlace esté mal escrito o que la página se haya movido.
          </Vacio>
        </Tarjeta>
      </Contenido>
    </>
  )
}
