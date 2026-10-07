// Posición del dispositivo (GPS) con mensajes de error en español.

export interface Posicion {
  latitud: number
  longitud: number
  /** Radio de error en metros. */
  precision: number
}

export function obtenerPosicion(): Promise<Posicion> {
  return new Promise((ok, mal) => {
    if (!('geolocation' in navigator)) {
      mal(new Error('Este dispositivo no permite obtener la ubicación.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ latitud: p.coords.latitude, longitud: p.coords.longitude, precision: p.coords.accuracy }),
      (e) => {
        if (e.code === e.PERMISSION_DENIED) {
          mal(new Error('No has dado permiso para usar la ubicación. Actívalo en los ajustes del navegador para esta página.'))
        } else if (e.code === e.TIMEOUT) {
          mal(new Error('Se ha tardado demasiado en obtener la posición. Sal a cielo abierto y vuelve a intentarlo.'))
        } else {
          mal(new Error('No se puede obtener la posición ahora mismo. Prueba en un sitio con mejor señal.'))
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
    )
  })
}

/** «±8 m» */
export function textoPrecision(metros: number): string {
  return `±${Math.round(metros)} m`
}
