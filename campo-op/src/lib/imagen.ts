// Reduce las fotos antes de guardarlas: una foto de móvil de 4-8 MB se queda
// en unos 200-400 KB a 1600 píxeles, más que suficiente para ver una finca.

export const LADO_MAXIMO = 1600

export async function reducirImagen(archivo: Blob, lado = LADO_MAXIMO, calidad = 0.8): Promise<Blob> {
  // createImageBitmap ya gira la foto según la orientación con que se hizo.
  const imagen = await createImageBitmap(archivo)
  try {
    const escala = Math.min(1, lado / Math.max(imagen.width, imagen.height))
    const ancho = Math.round(imagen.width * escala)
    const alto = Math.round(imagen.height * escala)
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    const ctx = lienzo.getContext('2d')
    if (!ctx) throw new Error('El navegador no permite procesar la foto.')
    ctx.drawImage(imagen, 0, 0, ancho, alto)
    return await new Promise<Blob>((ok, mal) =>
      lienzo.toBlob((b) => (b ? ok(b) : mal(new Error('No se ha podido procesar la foto.'))), 'image/jpeg', calidad),
    )
  } finally {
    imagen.close()
  }
}
