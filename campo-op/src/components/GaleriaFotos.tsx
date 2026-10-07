import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, ChevronLeft, ChevronRight, CloudOff, CloudUpload, Image as IconoImagen, LoaderCircle, Trash, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { db } from '../datos/db'
import { modificar } from '../datos/escritura'
import { agregarFoto, eliminarFoto, useFoto } from '../datos/fotos'
import { cx } from '../lib/cx'
import { formatearFechaHora } from '../lib/formato'
import type { Foto } from '../lib/tipos'
import { Aviso, Boton, Dialogo } from './ui'

/** Fotos de una finca: ver, hacer una nueva con la cámara o elegir de la galería. */
export function GaleriaFotos({ idFinca, fotos }: { idFinca: string; fotos: Foto[] }) {
  const camara = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)

  async function añadir(archivos: FileList | null) {
    if (!archivos?.length) return
    setError(null)
    setSubiendo((n) => n + archivos.length)
    for (const archivo of Array.from(archivos)) {
      try {
        await agregarFoto(idFinca, archivo)
      } catch {
        setError('No se ha podido guardar alguna foto. Comprueba que es una imagen.')
      } finally {
        setSubiendo((n) => n - 1)
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Boton variante="secundario" icono={Camera} onClick={() => camara.current?.click()}>
          Hacer foto
        </Boton>
        <Boton variante="secundario" icono={IconoImagen} onClick={() => galeria.current?.click()}>
          Galería
        </Boton>
      </div>
      {/* Con «capture» el móvil abre la cámara directamente. */}
      <input
        ref={camara}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label="Hacer foto"
        onChange={(e) => {
          void añadir(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={galeria}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        aria-label="Elegir fotos de la galería"
        onChange={(e) => {
          void añadir(e.target.files)
          e.target.value = ''
        }}
      />

      {error && <Aviso tipo="error">{error}</Aviso>}

      {fotos.length === 0 && subiendo === 0 ? (
        <p className="rounded-xl bg-stone-50 px-4 py-6 text-center text-sm text-stone-500">Esta finca todavía no tiene fotos.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {fotos.map((f) => (
            <li key={f.id}>
              <Miniatura foto={f} onAbrir={() => setAbierta(f.id)} />
            </li>
          ))}
          {Array.from({ length: subiendo }).map((_, i) => (
            <li key={`subiendo-${i}`} className="grid aspect-square place-items-center rounded-xl bg-stone-100">
              <LoaderCircle className="size-6 animate-spin text-stone-400" aria-label="Guardando foto" />
            </li>
          ))}
        </ul>
      )}

      {abierta && fotos.length > 0 && <Visor fotos={fotos} idInicial={abierta} alCerrar={() => setAbierta(null)} />}
    </div>
  )
}

function useSubida(id: string) {
  // 0 = falta subirla; undefined = no está en el móvil (ya está en Supabase).
  return useLiveQuery(async () => (await db.archivos.get(id))?.subido, [id])
}

function ImagenFoto({ foto, className }: { foto: Foto; className?: string }) {
  const estado = useFoto(foto)
  if (estado.tipo === 'lista') {
    return <img src={estado.url} alt={foto.descripcion || 'Foto de la finca'} className={className} draggable={false} />
  }
  return (
    <div className={cx('grid place-items-center bg-stone-100 text-stone-400', className)}>
      {estado.tipo === 'cargando' ? (
        <LoaderCircle className="size-6 animate-spin" aria-label="Cargando foto" />
      ) : (
        <span className="flex flex-col items-center gap-1 px-2 text-center text-xs">
          <CloudOff className="size-5" aria-hidden />
          {estado.tipo === 'sin-conexion' ? 'Sin conexión' : 'No disponible'}
        </span>
      )}
    </div>
  )
}

function Miniatura({ foto, onAbrir }: { foto: Foto; onAbrir: () => void }) {
  const subida = useSubida(foto.id)
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="relative block aspect-square w-full overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-200 active:opacity-80"
      aria-label={foto.descripcion ? `Foto: ${foto.descripcion}` : 'Abrir foto'}
    >
      <ImagenFoto foto={foto} className="size-full object-cover" />
      {subida === 0 && (
        <span className="absolute right-1.5 bottom-1.5 grid size-6 place-items-center rounded-full bg-amber-500 text-white" title="Pendiente de subir">
          <CloudUpload className="size-3.5" aria-label="Pendiente de subir" />
        </span>
      )}
    </button>
  )
}

function Visor({ fotos, idInicial, alCerrar }: { fotos: Foto[]; idInicial: string; alCerrar: () => void }) {
  const [id, setId] = useState(idInicial)
  const [ultimo, setUltimo] = useState(Math.max(0, fotos.findIndex((f) => f.id === idInicial)))
  // Si la foto actual desaparece (se borra), se enseña la que ocupa su lugar.
  const encontrada = fotos.findIndex((f) => f.id === id)
  const indice = encontrada >= 0 ? encontrada : Math.min(ultimo, fotos.length - 1)
  const foto = fotos[indice]
  if (encontrada < 0) {
    setId(foto.id)
  } else if (ultimo !== encontrada) {
    setUltimo(encontrada)
  }
  const [confirmar, setConfirmar] = useState(false)
  const [descripcion, setDescripcion] = useState<{ id: string; texto: string } | null>(null)

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (confirmar) return
      if (e.key === 'Escape') alCerrar()
      if (e.key === 'ArrowLeft' && indice > 0) setId(fotos[indice - 1].id)
      if (e.key === 'ArrowRight' && indice < fotos.length - 1) setId(fotos[indice + 1].id)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [confirmar, indice, fotos, alCerrar])

  const texto = descripcion?.id === foto.id ? descripcion.texto : (foto.descripcion ?? '')

  async function guardarDescripcion() {
    if (descripcion?.id === foto.id && descripcion.texto.trim() !== (foto.descripcion ?? '')) {
      await modificar('fotos', foto.id, { descripcion: descripcion.texto.trim() || null })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Foto de la finca">
      <div className="pt-seguro flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => {
            void guardarDescripcion()
            alCerrar()
          }}
          className="grid size-12 place-items-center rounded-full hover:bg-white/10"
          aria-label="Cerrar"
        >
          <X className="size-6" aria-hidden />
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-sm text-white/80">
          {indice + 1} de {fotos.length}
          {foto.tomada_en && ` · ${formatearFechaHora(foto.tomada_en)}`}
        </p>
        <button
          type="button"
          onClick={() => setConfirmar(true)}
          className="grid size-12 place-items-center rounded-full hover:bg-white/10"
          aria-label="Eliminar foto"
        >
          <Trash className="size-5" aria-hidden />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <ImagenFoto foto={foto} className="max-h-full max-w-full object-contain" />
        {indice > 0 && (
          <button
            type="button"
            onClick={() => setId(fotos[indice - 1].id)}
            className="absolute left-2 grid size-12 place-items-center rounded-full bg-black/50 hover:bg-black/70"
            aria-label="Foto anterior"
          >
            <ChevronLeft className="size-6" aria-hidden />
          </button>
        )}
        {indice < fotos.length - 1 && (
          <button
            type="button"
            onClick={() => setId(fotos[indice + 1].id)}
            className="absolute right-2 grid size-12 place-items-center rounded-full bg-black/50 hover:bg-black/70"
            aria-label="Foto siguiente"
          >
            <ChevronRight className="size-6" aria-hidden />
          </button>
        )}
      </div>

      <div className="pb-seguro px-4 pt-3 pb-3">
        <label htmlFor="descripcion-foto" className="sr-only">
          Descripción de la foto
        </label>
        <input
          id="descripcion-foto"
          type="text"
          value={texto}
          maxLength={200}
          onChange={(e) => setDescripcion({ id: foto.id, texto: e.target.value })}
          onBlur={() => void guardarDescripcion()}
          placeholder="Añadir una descripción (p. ej. plaga en cabecera)"
          className="block min-h-12 w-full rounded-xl border border-white/20 bg-white/10 px-3.5 text-white placeholder:text-white/50 focus:border-white/60 focus:outline-none"
        />
      </div>

      <Dialogo
        abierto={confirmar}
        titulo="¿Eliminar esta foto?"
        alCerrar={() => setConfirmar(false)}
        acciones={
          <>
            <Boton variante="secundario" onClick={() => setConfirmar(false)}>
              Cancelar
            </Boton>
            <Boton
              variante="eliminar"
              onClick={async () => {
                setConfirmar(false)
                await eliminarFoto(foto)
              }}
            >
              Eliminar
            </Boton>
          </>
        }
      >
        La foto desaparecerá de la ficha de la finca.
      </Dialogo>
    </div>
  )
}
