import { Save } from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { usePerfil } from '../../auth/contexto'
import { Cabecera, Contenido } from '../../components/Layout'
import { AreaTexto, Aviso, Boton, Campo, Cargando, Opciones, Tarjeta } from '../../components/ui'
import { useSocio, useSocios } from '../../datos/consultas'
import { crear, modificar } from '../../datos/escritura'
import { hoy, normalizar } from '../../lib/formato'
import type { Socio } from '../../lib/tipos'
import { comprobarNif, esCodigoPostal, esEmail, esTelefonoEspanol, limpiarNif } from '../../lib/validacion'

/** Los campos del formulario, todos como texto (así los manejan los inputs). */
interface Formulario {
  codigo: string
  nombre: string
  nif: string
  telefono: string
  email: string
  direccion: string
  codigo_postal: string
  localidad: string
  fecha_alta: string
  estado: 'activo' | 'baja'
  fecha_baja: string
  observaciones: string
}

type Errores = Partial<Record<keyof Formulario, string>>

function desdeSocio(s: Socio): Formulario {
  return {
    codigo: s.codigo,
    nombre: s.nombre,
    nif: s.nif ?? '',
    telefono: s.telefono ?? '',
    email: s.email ?? '',
    direccion: s.direccion ?? '',
    codigo_postal: s.codigo_postal ?? '',
    localidad: s.localidad ?? '',
    fecha_alta: s.fecha_alta ?? '',
    estado: s.estado,
    fecha_baja: s.fecha_baja ?? '',
    observaciones: s.observaciones ?? '',
  }
}

/** Propone el siguiente código: si los códigos son números, el mayor + 1 (con los mismos ceros delante). */
function siguienteCodigo(socios: Socio[]): string {
  const numericos = socios.map((s) => s.codigo).filter((c) => /^\d+$/.test(c))
  if (!numericos.length) return socios.length ? '' : '1'
  const mayor = numericos.reduce((a, b) => (BigInt(b) > BigInt(a) ? b : a))
  const largo = Math.max(...numericos.map((c) => c.length))
  return String(BigInt(mayor) + 1n).padStart(largo, '0')
}

export function FormularioSocio() {
  const { id } = useParams()
  const perfil = usePerfil()
  const socio = useSocio(id)
  const socios = useSocios()

  if (!id && perfil.rol !== 'admin') return <Navigate to="/socios" replace />
  if (socios === undefined || (id && socio === undefined)) {
    return (
      <>
        <Cabecera titulo={id ? 'Editar socio' : 'Nuevo socio'} atras />
        <Cargando />
      </>
    )
  }
  if (id && !socio) return <Navigate to="/socios" replace />

  const inicial: Formulario = socio
    ? desdeSocio(socio)
    : {
        codigo: siguienteCodigo(socios),
        nombre: '',
        nif: '',
        telefono: '',
        email: '',
        direccion: '',
        codigo_postal: '',
        localidad: '',
        fecha_alta: hoy(),
        estado: 'activo',
        fecha_baja: '',
        observaciones: '',
      }
  return <FormularioDatos key={id ?? 'nuevo'} socio={socio ?? null} socios={socios} inicial={inicial} />
}

function FormularioDatos({ socio, socios, inicial }: { socio: Socio | null; socios: Socio[]; inicial: Formulario }) {
  const navegar = useNavigate()
  const [datos, setDatos] = useState<Formulario>(inicial)
  const [errores, setErrores] = useState<Errores>({})
  const [guardando, setGuardando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  const codigosOcupados = useMemo(
    () => new Set(socios.filter((s) => s.id !== socio?.id).map((s) => normalizar(s.codigo))),
    [socios, socio],
  )

  function cambiar<K extends keyof Formulario>(campo: K, valor: Formulario[K]) {
    setDatos((d) => {
      const nuevos = { ...d, [campo]: valor }
      // Al marcar la baja, se propone la fecha de hoy.
      if (campo === 'estado' && valor === 'baja' && !d.fecha_baja) nuevos.fecha_baja = hoy()
      return nuevos
    })
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  const avisoNif = useMemo(() => {
    if (!datos.nif.trim()) return null
    const r = comprobarNif(datos.nif)
    if (r.estado === 'desconocido') return 'No parece un NIF español. Si es un documento extranjero, puedes dejarlo así.'
    if (r.estado === 'valido') return `${r.tipo} correcto.`
    return null
  }, [datos.nif])

  const avisoTelefono =
    datos.telefono.trim() && !esTelefonoEspanol(datos.telefono)
      ? 'No parece un teléfono español de 9 cifras. Revísalo si no es extranjero.'
      : null

  function validar(): Errores {
    const e: Errores = {}
    if (!datos.codigo.trim()) e.codigo = 'El código es obligatorio.'
    else if (codigosOcupados.has(normalizar(datos.codigo))) e.codigo = 'Ya hay otro socio con este código.'
    if (!datos.nombre.trim()) e.nombre = 'Escribe el nombre o la razón social.'
    const nif = comprobarNif(datos.nif)
    if (datos.nif.trim() && nif.estado === 'incorrecto') {
      e.nif = `La letra o el dígito de control de este ${nif.tipo} no cuadra. Revísalo.`
    }
    if (datos.email.trim() && !esEmail(datos.email)) e.email = 'Este email no es válido.'
    if (datos.codigo_postal.trim() && !esCodigoPostal(datos.codigo_postal)) {
      e.codigo_postal = 'El código postal tiene 5 cifras (p. ej. 04700).'
    }
    if (datos.estado === 'baja' && datos.fecha_baja && datos.fecha_alta && datos.fecha_baja < datos.fecha_alta) {
      e.fecha_baja = 'La baja no puede ser anterior al alta.'
    }
    return e
  }

  async function guardar(ev: FormEvent) {
    ev.preventDefault()
    const e = validar()
    setErrores(e)
    if (Object.keys(e).length) {
      setErrorGeneral('Revisa los campos marcados en rojo.')
      return
    }
    setErrorGeneral(null)
    setGuardando(true)
    const texto = (v: string) => v.trim() || null
    const valores = {
      codigo: datos.codigo.trim(),
      nombre: datos.nombre.trim(),
      nif: datos.nif.trim() ? limpiarNif(datos.nif) : null,
      telefono: texto(datos.telefono),
      email: texto(datos.email)?.toLowerCase() ?? null,
      direccion: texto(datos.direccion),
      codigo_postal: texto(datos.codigo_postal),
      localidad: texto(datos.localidad),
      fecha_alta: datos.fecha_alta || null,
      estado: datos.estado,
      fecha_baja: datos.estado === 'baja' ? datos.fecha_baja || null : null,
      observaciones: texto(datos.observaciones),
    }
    try {
      if (socio) {
        await modificar('socios', socio.id, valores)
        navegar(`/socios/${socio.id}`, { replace: true })
      } else {
        const nuevo = await crear('socios', valores)
        navegar(`/socios/${nuevo}`, { replace: true })
      }
    } catch (err) {
      setGuardando(false)
      setErrorGeneral(err instanceof Error ? err.message : String(err))
    }
  }

  const campo = (nombre: keyof Formulario) => ({
    value: datos[nombre],
    onChange: (e: { target: { value: string } }) => cambiar(nombre, e.target.value as never),
    error: errores[nombre],
  })

  return (
    <>
      <Cabecera titulo={socio ? 'Editar socio' : 'Nuevo socio'} subtitulo={socio?.nombre} atras />
      <Contenido>
        <form onSubmit={guardar} noValidate className="space-y-5">
          <Grupo titulo="Identificación">
            <Campo etiqueta="Código de socio *" autoComplete="off" inputMode="text" {...campo('codigo')} />
            <Campo etiqueta="Nombre o razón social *" autoComplete="off" autoCapitalize="words" {...campo('nombre')} />
            <Campo
              etiqueta="NIF / CIF"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              {...campo('nif')}
              ayuda={avisoNif}
            />
          </Grupo>

          <Grupo titulo="Contacto">
            <Campo etiqueta="Teléfono" type="tel" inputMode="tel" autoComplete="off" {...campo('telefono')} ayuda={avisoTelefono} />
            <Campo
              etiqueta="Email"
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              {...campo('email')}
            />
          </Grupo>

          <Grupo titulo="Dirección">
            <Campo etiqueta="Calle y número" autoComplete="off" {...campo('direccion')} />
            <div className="grid grid-cols-[7rem_1fr] gap-3">
              <Campo etiqueta="C. postal" inputMode="numeric" maxLength={5} autoComplete="off" {...campo('codigo_postal')} />
              <Campo etiqueta="Localidad" autoComplete="off" {...campo('localidad')} />
            </div>
          </Grupo>

          <Grupo titulo="Situación en la OP">
            <Campo etiqueta="Fecha de alta" type="date" {...campo('fecha_alta')} />
            <div>
              <p className="mb-1.5 text-sm font-medium text-stone-700">Estado</p>
              <Opciones
                etiqueta="Estado"
                valor={datos.estado}
                onChange={(v) => cambiar('estado', v)}
                opciones={[
                  { valor: 'activo', texto: 'Activo' },
                  { valor: 'baja', texto: 'De baja' },
                ]}
              />
            </div>
            {datos.estado === 'baja' && <Campo etiqueta="Fecha de baja" type="date" {...campo('fecha_baja')} />}
          </Grupo>

          <Grupo titulo="Observaciones">
            <AreaTexto
              etiqueta="Notas sobre el socio"
              value={datos.observaciones}
              onChange={(e) => cambiar('observaciones', e.target.value)}
            />
          </Grupo>

          {errorGeneral && <Aviso tipo="error">{errorGeneral}</Aviso>}

          <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-4 bg-gradient-to-t from-fondo via-fondo to-fondo/0 px-4 pt-4 pb-3 lg:bottom-0">
            <Boton type="submit" icono={Save} cargando={guardando} bloque>
              {socio ? 'Guardar cambios' : 'Dar de alta'}
            </Boton>
          </div>
        </form>
      </Contenido>
    </>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 px-1 text-sm font-semibold tracking-wide text-stone-500 uppercase">{titulo}</legend>
      <Tarjeta className="space-y-4 p-4">{children}</Tarjeta>
    </fieldset>
  )
}
