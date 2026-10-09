import { CloudOff, RefreshCw, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePerfil } from '../../auth/contexto'
import { Cabecera, Contenido } from '../../components/Layout'
import { Aviso, Boton, Cargando, Insignia, Tarjeta, Vacio } from '../../components/ui'
import { useConexion } from '../../hooks/useConexion'
import { cx } from '../../lib/cx'
import { mensajeDeError } from '../../lib/errores'
import { supabase } from '../../lib/supabase'
import { NOMBRES_ROL, type Perfil, type Rol } from '../../lib/tipos'

/** Solo administradores: ver los usuarios, cambiar su rol y activarlos o desactivarlos. */
export function Usuarios() {
  const yo = usePerfil()
  const conexion = useConexion()
  const [usuarios, setUsuarios] = useState<Perfil[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)

  const [recargas, setRecargas] = useState(0)

  useEffect(() => {
    if (!conexion) return
    let vigente = true
    void supabase
      .from('perfiles')
      .select('*')
      .order('nombre')
      .then(({ data, error }) => {
        if (!vigente) return
        setError(error ? mensajeDeError(error) : null)
        if (!error) setUsuarios(data as Perfil[])
      })
    return () => {
      vigente = false
    }
  }, [conexion, recargas])

  async function cambiar(usuario: Perfil, cambios: Partial<Pick<Perfil, 'rol' | 'activo'>>) {
    setGuardando(usuario.id)
    setError(null)
    const { data, error } = await supabase.from('perfiles').update(cambios).eq('id', usuario.id).select().single()
    setGuardando(null)
    if (error) {
      setError(mensajeDeError(error))
      return
    }
    setUsuarios((lista) => lista?.map((u) => (u.id === usuario.id ? (data as Perfil) : u)) ?? null)
  }

  return (
    <>
      <Cabecera
        titulo="Usuarios y técnicos"
        atras="/mas"
        acciones={
          conexion && (
            <button
              type="button"
              onClick={() => setRecargas((n) => n + 1)}
              className="grid size-12 place-items-center rounded-full text-stone-600 hover:bg-stone-200/60"
              aria-label="Recargar"
            >
              <RefreshCw className="size-5" aria-hidden />
            </button>
          )
        }
      />
      <Contenido className="space-y-4">
        {!conexion ? (
          <Tarjeta>
            <Vacio icono={CloudOff} titulo="Sin conexión">
              La gestión de usuarios necesita cobertura porque los cambios se aplican al momento en el servidor.
            </Vacio>
          </Tarjeta>
        ) : (
          <>
            {error && <Aviso tipo="error">{error}</Aviso>}
            {!usuarios ? (
              !error && <Cargando />
            ) : (
              <ul className="space-y-3">
                {usuarios.map((u) => (
                  <li key={u.id}>
                    <FichaUsuario
                      usuario={u}
                      esYo={u.id === yo.id}
                      guardando={guardando === u.id}
                      onCambiar={(c) => void cambiar(u, c)}
                    />
                  </li>
                ))}
              </ul>
            )}
            <Aviso tipo="info" titulo="¿Cómo doy de alta a un técnico nuevo?">
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                <li>
                  Entra en <strong>supabase.com</strong> → tu proyecto → <strong>Authentication</strong> →{' '}
                  <strong>Users</strong>.
                </li>
                <li>
                  Pulsa <strong>Add user → Create new user</strong>, escribe su email y una contraseña provisional y
                  marca <strong>Auto Confirm User</strong>.
                </li>
                <li>Vuelve aquí y pulsa recargar: aparecerá como Técnico.</li>
              </ol>
              <p className="mt-2">Más adelante podrás crearlos desde la propia app.</p>
            </Aviso>
          </>
        )}
      </Contenido>
    </>
  )
}

function FichaUsuario({ usuario, esYo, guardando, onCambiar }: {
  usuario: Perfil
  esYo: boolean
  guardando: boolean
  onCambiar: (cambios: Partial<Pick<Perfil, 'rol' | 'activo'>>) => void
}) {
  return (
    <Tarjeta className={cx('p-4 transition', !usuario.activo && 'opacity-70', guardando && 'animate-pulse')}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-stone-900">
            {usuario.nombre || 'Sin nombre'} {esYo && <span className="font-normal text-stone-500">(tú)</span>}
          </p>
          <p className="truncate text-sm text-stone-500">{usuario.email}</p>
        </div>
        {usuario.activo ? <Insignia color="marca">Activo</Insignia> : <Insignia color="rojo">Sin acceso</Insignia>}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Rol" className="inline-flex rounded-xl bg-stone-100 p-1">
          {(['tecnico', 'admin'] as Rol[]).map((rol) => (
            <button
              key={rol}
              type="button"
              role="radio"
              aria-checked={usuario.rol === rol}
              disabled={guardando}
              onClick={() => usuario.rol !== rol && onCambiar({ rol })}
              className={cx(
                'min-h-10 rounded-lg px-3 text-sm font-medium transition',
                usuario.rol === rol ? 'bg-white text-marca-800 shadow-sm' : 'text-stone-600 hover:text-stone-900',
              )}
            >
              {NOMBRES_ROL[rol]}
            </button>
          ))}
        </div>
        {!esYo && (
          <Boton
            variante={usuario.activo ? 'peligro' : 'secundario'}
            className="ml-auto min-h-10 text-sm"
            icono={usuario.activo ? undefined : UserPlus}
            disabled={guardando}
            onClick={() => onCambiar({ activo: !usuario.activo })}
          >
            {usuario.activo ? 'Quitar acceso' : 'Dar acceso'}
          </Boton>
        )}
      </div>
    </Tarjeta>
  )
}
