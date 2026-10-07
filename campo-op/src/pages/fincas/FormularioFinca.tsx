import { Crosshair, ExternalLink, Plus, Save } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { Cabecera, Contenido } from '../../components/Layout'
import { EditorRecintos } from '../../components/EditorRecintos'
import { SelectorSocio } from '../../components/SelectorSocio'
import {
  AreaTexto,
  Aviso,
  BarraGuardar,
  Boton,
  Campo,
  Cargando,
  Etiqueta,
  GrupoFormulario,
  Opciones,
  Seleccion,
} from '../../components/ui'
import { useFinca, useFincas, useRecintosDeFinca, useSocio } from '../../datos/consultas'
import { crear, eliminar, modificar } from '../../datos/escritura'
import {
  campanaDe,
  campanasRecientes,
  CERTIFICACIONES_HABITUALES,
  CULTIVOS_HABITUALES,
  NOMBRES_TIPO_INVERNADERO,
} from '../../lib/catalogos'
import { PROVINCIA_ALMERIA, PROVINCIAS } from '../../lib/codigosSigpac'
import { sumaSuperficies } from '../../lib/fincas'
import { formatearHa, HA_A_M2, hoy, numeroParaCampo, parsearNumero } from '../../lib/formato'
import { obtenerPosicion, textoPrecision } from '../../lib/gps'
import { municipiosDe, type RecintoBorrador } from '../../lib/sigpac'
import type { Finca, Recinto, TipoFinca, TipoInvernadero } from '../../lib/tipos'

interface Formulario {
  socio_id: string
  nombre: string
  provincia: string
  municipio: string
  tipo: '' | TipoFinca
  tipo_invernadero: '' | TipoInvernadero
  tipo_invernadero_otro: string
  ha: string
  m2: string
  cultivo: string
  campana: string
  certificaciones: string[]
  latitud: string
  longitud: string
  fecha_ultima_visita: string
  observaciones: string
}

type Errores = Partial<Record<keyof Formulario, string>>

function desdeFinca(f: Finca): Formulario {
  return {
    socio_id: f.socio_id,
    nombre: f.nombre,
    provincia: String(f.provincia),
    municipio: f.municipio === null ? '' : String(f.municipio),
    tipo: f.tipo ?? '',
    tipo_invernadero: f.tipo_invernadero ?? '',
    tipo_invernadero_otro: f.tipo_invernadero_otro ?? '',
    ha: numeroParaCampo(f.superficie_ha),
    m2: numeroParaCampo(f.superficie_ha === null ? null : f.superficie_ha * HA_A_M2, 2),
    cultivo: f.cultivo ?? '',
    campana: f.campana ?? '',
    certificaciones: f.certificaciones,
    latitud: numeroParaCampo(f.latitud, 7),
    longitud: numeroParaCampo(f.longitud, 7),
    fecha_ultima_visita: f.fecha_ultima_visita ?? '',
    observaciones: f.observaciones ?? '',
  }
}

function aBorrador(r: Recinto): RecintoBorrador {
  return {
    clave: r.id,
    existente: true,
    provincia: r.provincia,
    municipio: r.municipio,
    agregado: r.agregado,
    zona: r.zona,
    poligono: r.poligono,
    parcela: r.parcela,
    recinto: r.recinto ?? 0,
    superficie_ha: r.superficie_ha,
    uso_sigpac: r.uso_sigpac,
    geometria: r.geometria,
  }
}

export function FormularioFinca() {
  const { id } = useParams()
  const [parametros] = useSearchParams()
  const finca = useFinca(id)
  const recintos = useRecintosDeFinca(id)
  const socioInicial = parametros.get('socio') ?? ''
  const socioPrevio = useSocio(socioInicial || undefined)

  const cargando = (id && (finca === undefined || recintos === undefined)) || (socioInicial && socioPrevio === undefined)
  if (cargando) {
    return (
      <>
        <Cabecera titulo={id ? 'Editar finca' : 'Nueva finca'} atras />
        <Cargando />
      </>
    )
  }
  if (id && !finca) return <Navigate to="/fincas" replace />

  const inicial: Formulario = finca
    ? desdeFinca(finca)
    : {
        socio_id: socioPrevio?.id ?? '',
        nombre: '',
        provincia: String(PROVINCIA_ALMERIA),
        municipio: '',
        tipo: '',
        tipo_invernadero: '',
        tipo_invernadero_otro: '',
        ha: '',
        m2: '',
        cultivo: '',
        campana: campanaDe(),
        certificaciones: [],
        latitud: '',
        longitud: '',
        fecha_ultima_visita: '',
        observaciones: '',
      }
  return <FormularioDatos key={id ?? 'nueva'} finca={finca ?? null} recintosGuardados={recintos ?? []} inicial={inicial} />
}

function useMunicipios(provincia: number) {
  const [lista, setLista] = useState<{ provincia: number; datos: [number, string][] } | null>(null)
  useEffect(() => {
    let vigente = true
    municipiosDe(provincia)
      .then((datos) => vigente && setLista({ provincia, datos }))
      .catch(() => vigente && setLista({ provincia, datos: [] }))
    return () => {
      vigente = false
    }
  }, [provincia])
  return lista?.provincia === provincia ? lista.datos : null
}

function FormularioDatos({ finca, recintosGuardados, inicial }: {
  finca: Finca | null
  recintosGuardados: Recinto[]
  inicial: Formulario
}) {
  const navegar = useNavigate()
  const todas = useFincas()
  const [idNueva] = useState(() => crypto.randomUUID())
  const idFinca = finca?.id ?? idNueva
  const [datos, setDatos] = useState<Formulario>(inicial)
  const [recintos, setRecintos] = useState<RecintoBorrador[]>(() => recintosGuardados.map(aBorrador))
  const [errores, setErrores] = useState<Errores>({})
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [obteniendoGps, setObteniendoGps] = useState(false)
  const [errorGps, setErrorGps] = useState<string | null>(null)
  const [precisionGps, setPrecisionGps] = useState<number | null>(null)
  const [otraCertificacion, setOtraCertificacion] = useState('')

  const municipios = useMunicipios(Number(datos.provincia))

  function cambiar<K extends keyof Formulario>(campo: K, valor: Formulario[K]) {
    setDatos((d) => ({ ...d, [campo]: valor }))
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }))
  }

  // Superficie: hectáreas y metros cuadrados siempre van a la par.
  function cambiarHa(texto: string) {
    const n = parsearNumero(texto)
    setDatos((d) => ({ ...d, ha: texto, m2: n === null ? (texto.trim() ? d.m2 : '') : numeroParaCampo(n * HA_A_M2, 2) }))
    setErrores((e) => ({ ...e, ha: undefined }))
  }
  function cambiarM2(texto: string) {
    const n = parsearNumero(texto)
    setDatos((d) => ({ ...d, m2: texto, ha: n === null ? (texto.trim() ? d.ha : '') : numeroParaCampo(n / HA_A_M2, 4) }))
    setErrores((e) => ({ ...e, ha: undefined }))
  }

  function cambiarRecintos(nuevos: RecintoBorrador[]) {
    setRecintos(nuevos)
    // El primer recinto sirve para rellenar el municipio si aún no se ha elegido.
    const primero = nuevos[0]
    const suma = sumaSuperficies(nuevos)
    setDatos((d) => ({
      ...d,
      ...(primero && !d.municipio ? { provincia: String(primero.provincia), municipio: String(primero.municipio) } : {}),
      // Si aún no se ha indicado la superficie, se toma la de los recintos (se puede cambiar).
      ...(!d.ha.trim() && suma !== null ? { ha: numeroParaCampo(suma), m2: numeroParaCampo(suma * HA_A_M2, 2) } : {}),
    }))
  }

  const sumaRecintos = sumaSuperficies(recintos)

  const cultivosSugeridos = useMemo(() => {
    const usados = (todas ?? []).map((f) => f.cultivo).filter((c): c is string => Boolean(c))
    return [...new Set([...CULTIVOS_HABITUALES, ...usados])].sort((a, b) => a.localeCompare(b, 'es'))
  }, [todas])

  const campanas = useMemo(() => {
    const lista = campanasRecientes()
    return datos.campana && !lista.includes(datos.campana) ? [...lista, datos.campana].sort().reverse() : lista
  }, [datos.campana])

  const certificaciones = useMemo(
    () => [...CERTIFICACIONES_HABITUALES, ...datos.certificaciones.filter((c) => !CERTIFICACIONES_HABITUALES.includes(c))],
    [datos.certificaciones],
  )

  function alternarCertificacion(nombre: string) {
    cambiar(
      'certificaciones',
      datos.certificaciones.includes(nombre) ? datos.certificaciones.filter((c) => c !== nombre) : [...datos.certificaciones, nombre],
    )
  }

  function añadirOtraCertificacion() {
    const nombre = otraCertificacion.trim()
    if (nombre && !datos.certificaciones.some((c) => c.toLowerCase() === nombre.toLowerCase())) {
      cambiar('certificaciones', [...datos.certificaciones, nombre])
    }
    setOtraCertificacion('')
  }

  async function usarMiPosicion() {
    setObteniendoGps(true)
    setErrorGps(null)
    try {
      const p = await obtenerPosicion()
      setDatos((d) => ({ ...d, latitud: numeroParaCampo(p.latitud, 7), longitud: numeroParaCampo(p.longitud, 7) }))
      setPrecisionGps(p.precision)
      setErrores((e) => ({ ...e, latitud: undefined, longitud: undefined }))
    } catch (e) {
      setErrorGps(e instanceof Error ? e.message : String(e))
    } finally {
      setObteniendoGps(false)
    }
  }

  function validar(): Errores {
    const e: Errores = {}
    if (!datos.socio_id) e.socio_id = 'Elige el socio al que pertenece la finca.'
    if (!datos.nombre.trim()) e.nombre = 'Escribe el nombre o código de la finca.'
    if (datos.ha.trim()) {
      const ha = parsearNumero(datos.ha)
      if (ha === null || ha < 0) e.ha = 'La superficie tiene que ser un número (p. ej. 1,25).'
      else if (ha > 100000) e.ha = 'Esta superficie parece demasiado grande. Revísala.'
    }
    const lat = parsearNumero(datos.latitud)
    const lon = parsearNumero(datos.longitud)
    if (datos.latitud.trim() || datos.longitud.trim()) {
      if (lat === null) e.latitud = 'Escribe la latitud como número (p. ej. 36,7380).'
      if (lon === null) e.longitud = 'Escribe la longitud como número (p. ej. -2,7366).'
      if (lat !== null && lon !== null && (lat < 27 || lat > 44.5 || lon < -19 || lon > 5)) {
        e.latitud = 'Estas coordenadas no parecen estar en España. ¿Has cambiado la latitud y la longitud?'
      }
    }
    return e
  }

  async function guardar(ev: FormEvent) {
    ev.preventDefault()
    const e = validar()
    setErrores(e)
    if (Object.keys(e).length) return
    setErrorGuardado(null)
    setGuardando(true)
    const texto = (v: string) => v.trim() || null
    const ha = parsearNumero(datos.ha)
    const esInvernadero = datos.tipo === 'invernadero'
    const valores = {
      socio_id: datos.socio_id,
      nombre: datos.nombre.trim(),
      provincia: Number(datos.provincia),
      municipio: datos.municipio ? Number(datos.municipio) : null,
      tipo: datos.tipo || null,
      tipo_invernadero: esInvernadero ? datos.tipo_invernadero || null : null,
      tipo_invernadero_otro: esInvernadero && datos.tipo_invernadero === 'otro' ? texto(datos.tipo_invernadero_otro) : null,
      superficie_ha: ha === null ? null : Math.round(ha * 10000) / 10000,
      cultivo: texto(datos.cultivo),
      campana: texto(datos.campana),
      latitud: datos.latitud.trim() ? parsearNumero(datos.latitud) : null,
      longitud: datos.longitud.trim() ? parsearNumero(datos.longitud) : null,
      certificaciones: datos.certificaciones,
      observaciones: texto(datos.observaciones),
      fecha_ultima_visita: datos.fecha_ultima_visita || null,
    }
    try {
      if (finca) await modificar('fincas', finca.id, valores)
      else await crear('fincas', valores, idFinca)

      // Recintos: se quitan los que ya no están y se crean los nuevos.
      const quedan = new Set(recintos.map((r) => r.clave))
      for (const r of recintosGuardados) if (!quedan.has(r.id)) await eliminar('recintos', r.id)
      for (const r of recintos.filter((r) => !r.existente)) {
        await crear(
          'recintos',
          {
            finca_id: idFinca,
            provincia: r.provincia,
            municipio: r.municipio,
            agregado: r.agregado,
            zona: r.zona,
            poligono: r.poligono,
            parcela: r.parcela,
            recinto: r.recinto,
            superficie_ha: r.superficie_ha,
            uso_sigpac: r.uso_sigpac,
            geometria: r.geometria,
          },
          r.clave,
        )
      }
      navegar(`/fincas/${idFinca}`, { replace: true })
    } catch (err) {
      setGuardando(false)
      setErrorGuardado(err instanceof Error ? err.message : String(err))
    }
  }

  const campo = (nombre: keyof Formulario) => ({
    value: datos[nombre] as string,
    onChange: (e: { target: { value: string } }) => cambiar(nombre, e.target.value as never),
    error: errores[nombre],
  })

  const hayErrores = Object.values(errores).some(Boolean)
  const hayCoordenadas = parsearNumero(datos.latitud) !== null && parsearNumero(datos.longitud) !== null

  return (
    <>
      <Cabecera titulo={finca ? 'Editar finca' : 'Nueva finca'} subtitulo={finca?.nombre} atras />
      <Contenido>
        <form onSubmit={guardar} noValidate className="space-y-5">
          <GrupoFormulario titulo="Identificación">
            <SelectorSocio valor={datos.socio_id} onChange={(v) => cambiar('socio_id', v)} error={errores.socio_id} />
            <Campo etiqueta="Nombre o código de la finca *" autoComplete="off" autoCapitalize="words" {...campo('nombre')} />
            <div className="grid grid-cols-2 gap-3">
              <Seleccion
                etiqueta="Provincia"
                value={datos.provincia}
                onChange={(e) => setDatos((d) => ({ ...d, provincia: e.target.value, municipio: '' }))}
                opciones={PROVINCIAS.map(([c, n]) => ({ valor: String(c), texto: n }))}
              />
              <Seleccion
                etiqueta="Municipio"
                value={datos.municipio}
                onChange={(e) => cambiar('municipio', e.target.value)}
                vacia={municipios ? 'Sin indicar' : 'Cargando…'}
                opciones={(municipios ?? [])
                  .map(([c, n]) => ({ valor: String(c), texto: n }))
                  .sort((a, b) => a.texto.localeCompare(b.texto, 'es'))}
              />
            </div>
          </GrupoFormulario>

          <GrupoFormulario titulo="Tipo y superficie">
            <div>
              <p className="mb-1.5 text-sm font-medium text-stone-700">Tipo de finca</p>
              <Opciones
                etiqueta="Tipo de finca"
                valor={datos.tipo}
                onChange={(v) => cambiar('tipo', v)}
                opciones={[
                  { valor: 'invernadero', texto: 'Invernadero' },
                  { valor: 'aire_libre', texto: 'Aire libre' },
                  { valor: '', texto: 'Sin indicar' },
                ]}
              />
            </div>
            {datos.tipo === 'invernadero' && (
              <>
                <Seleccion
                  etiqueta="Tipo de invernadero"
                  value={datos.tipo_invernadero}
                  onChange={(e) => cambiar('tipo_invernadero', e.target.value as TipoInvernadero | '')}
                  vacia="Sin indicar"
                  opciones={Object.entries(NOMBRES_TIPO_INVERNADERO).map(([valor, texto]) => ({ valor, texto }))}
                />
                {datos.tipo_invernadero === 'otro' && (
                  <Campo etiqueta="¿Qué tipo?" placeholder="p. ej. Venlo, asimétrico…" {...campo('tipo_invernadero_otro')} />
                )}
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Campo
                etiqueta="Superficie (ha)"
                inputMode="decimal"
                autoComplete="off"
                value={datos.ha}
                onChange={(e) => cambiarHa(e.target.value)}
                error={errores.ha}
              />
              <Campo etiqueta="Superficie (m²)" inputMode="decimal" autoComplete="off" value={datos.m2} onChange={(e) => cambiarM2(e.target.value)} />
            </div>
            {sumaRecintos !== null && parsearNumero(datos.ha) !== sumaRecintos && (
              <button
                type="button"
                onClick={() => cambiarHa(numeroParaCampo(sumaRecintos))}
                className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-marca-50 px-3 text-left text-sm text-marca-900 hover:bg-marca-100"
              >
                <Plus className="size-4 shrink-0" aria-hidden />
                <span>
                  Usar la superficie de los recintos SIGPAC: <strong>{formatearHa(sumaRecintos, 4)}</strong>
                </span>
              </button>
            )}
          </GrupoFormulario>

          <GrupoFormulario titulo="Cultivo y certificaciones">
            <div>
              <Campo etiqueta="Cultivo actual" list="cultivos-sugeridos" autoComplete="off" autoCapitalize="sentences" {...campo('cultivo')} />
              <datalist id="cultivos-sugeridos">
                {cultivosSugeridos.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <Seleccion
              etiqueta="Campaña"
              value={datos.campana}
              onChange={(e) => cambiar('campana', e.target.value)}
              vacia="Sin indicar"
              opciones={campanas.map((c) => ({ valor: c, texto: c }))}
            />
            <div>
              <p className="mb-2 text-sm font-medium text-stone-700">Certificaciones</p>
              <div className="flex flex-wrap gap-2">
                {certificaciones.map((c) => (
                  <Etiqueta key={c} marcada={datos.certificaciones.includes(c)} onClick={() => alternarCertificacion(c)}>
                    {c}
                  </Etiqueta>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={otraCertificacion}
                  onChange={(e) => setOtraCertificacion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      añadirOtraCertificacion()
                    }
                  }}
                  placeholder="Otra certificación…"
                  aria-label="Otra certificación"
                  className="block min-h-12 min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3.5 text-stone-900 placeholder:text-stone-400 focus:border-marca-600 focus:ring-2 focus:ring-marca-600/20 focus:outline-none"
                />
                <Boton variante="secundario" icono={Plus} disabled={!otraCertificacion.trim()} onClick={añadirOtraCertificacion}>
                  Añadir
                </Boton>
              </div>
            </div>
          </GrupoFormulario>

          <GrupoFormulario titulo="Recintos SIGPAC">
            <EditorRecintos
              recintos={recintos}
              onChange={cambiarRecintos}
              alObtenerPosicion={(lat, lon) => {
                setDatos((d) =>
                  d.latitud || d.longitud ? d : { ...d, latitud: numeroParaCampo(lat, 7), longitud: numeroParaCampo(lon, 7) },
                )
              }}
            />
          </GrupoFormulario>

          <GrupoFormulario titulo="Ubicación (punto GPS)">
            <Boton variante="secundario" icono={Crosshair} cargando={obteniendoGps} bloque onClick={() => void usarMiPosicion()}>
              Usar mi posición
            </Boton>
            {errorGps && <Aviso tipo="error">{errorGps}</Aviso>}
            {precisionGps !== null && !errorGps && (
              <p className="text-sm text-stone-600">Posición guardada en el formulario (precisión {textoPrecision(precisionGps)}).</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Latitud" inputMode="decimal" autoComplete="off" {...campo('latitud')} />
              <Campo etiqueta="Longitud" inputMode="decimal" autoComplete="off" {...campo('longitud')} />
            </div>
            {hayCoordenadas && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${parsearNumero(datos.latitud)},${parsearNumero(datos.longitud)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-marca-800 hover:underline"
              >
                <ExternalLink className="size-4" aria-hidden />
                Comprobar en Google Maps
              </a>
            )}
          </GrupoFormulario>

          <GrupoFormulario titulo="Seguimiento">
            <div className="flex items-end gap-2">
              <Campo className="flex-1" etiqueta="Fecha de la última visita" type="date" {...campo('fecha_ultima_visita')} />
              <Boton variante="secundario" onClick={() => cambiar('fecha_ultima_visita', hoy())}>
                Hoy
              </Boton>
            </div>
            <AreaTexto
              etiqueta="Observaciones"
              value={datos.observaciones}
              onChange={(e) => cambiar('observaciones', e.target.value)}
            />
          </GrupoFormulario>

          {hayErrores && <Aviso tipo="error">Revisa los campos marcados en rojo.</Aviso>}
          {errorGuardado && <Aviso tipo="error">{errorGuardado}</Aviso>}

          <BarraGuardar>
            <Boton type="submit" icono={Save} cargando={guardando} bloque>
              {finca ? 'Guardar cambios' : 'Crear finca'}
            </Boton>
          </BarraGuardar>
        </form>
      </Contenido>
    </>
  )
}
