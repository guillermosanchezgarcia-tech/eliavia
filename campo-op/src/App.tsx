import { SearchX } from 'lucide-react'
import { lazy, Suspense, type ReactElement } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth, usePerfil } from './auth/contexto'
import { Cabecera, Contenido, Layout } from './components/Layout'
import { Cargando, Tarjeta, Vacio } from './components/ui'
import { configurado } from './config'
import { EnlaceNoValido } from './pages/acceso/EnlaceNoValido'
import { Login } from './pages/acceso/Login'
import { RecuperarClave } from './pages/acceso/RecuperarClave'
import { ConfiguracionPendiente, CuentaDesactivada, PantallaCargando, PantallaError } from './pages/Estados'
import { Inicio } from './pages/Inicio'
import { Informes } from './pages/informes/Informes'
import { CambiarClave } from './pages/mas/CambiarClave'
import { Mas } from './pages/mas/Mas'
import { Sincronizacion } from './pages/mas/Sincronizacion'
import { Usuarios } from './pages/mas/Usuarios'
import { FichaFinca } from './pages/fincas/FichaFinca'
import { FormularioFinca } from './pages/fincas/FormularioFinca'
import { ListaFincas } from './pages/fincas/ListaFincas'
import { FichaSocio } from './pages/socios/FichaSocio'
import { FormularioSocio } from './pages/socios/FormularioSocio'
import { ListaSocios } from './pages/socios/ListaSocios'

// El mapa pesa bastante (Leaflet): se descarga solo al abrirlo.
const Mapa = lazy(() => import('./pages/mapa/Mapa').then((m) => ({ default: m.Mapa })))

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
        <Route path="fincas" element={<ListaFincas />} />
        <Route path="fincas/nueva" element={<FormularioFinca />} />
        <Route path="fincas/:id" element={<FichaFinca />} />
        <Route path="fincas/:id/editar" element={<FormularioFinca />} />
        <Route
          path="mapa"
          element={
            <Suspense fallback={<Cargando texto="Abriendo el mapa…" />}>
              <Mapa />
            </Suspense>
          }
        />
        <Route path="informes" element={<Informes />} />
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
