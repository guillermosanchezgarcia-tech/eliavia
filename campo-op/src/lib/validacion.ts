// Comprobaciones de datos: NIF/NIE/CIF, teléfono, email y código postal.

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE'

/** Quita espacios, puntos y guiones y pasa a mayúsculas: «12.345.678-z» → «12345678Z». */
export function limpiarNif(valor: string): string {
  return valor.toUpperCase().replace(/[\s.\-/]/g, '')
}

export type ResultadoNif =
  | { estado: 'valido'; tipo: 'DNI' | 'NIE' | 'CIF' }
  | { estado: 'incorrecto'; tipo: 'DNI' | 'NIE' | 'CIF' }
  | { estado: 'desconocido' }

/**
 * Comprueba un NIF español. «incorrecto» = tiene el formato de un DNI, NIE o
 * CIF pero el dígito o letra de control no cuadra (casi seguro una errata).
 * «desconocido» = no parece un documento español (p. ej. extranjero).
 */
export function comprobarNif(valor: string): ResultadoNif {
  const nif = limpiarNif(valor)

  if (/^\d{8}[A-Z]$/.test(nif)) {
    const ok = LETRAS_DNI[Number(nif.slice(0, 8)) % 23] === nif[8]
    return { estado: ok ? 'valido' : 'incorrecto', tipo: 'DNI' }
  }

  if (/^[XYZ]\d{7}[A-Z]$/.test(nif)) {
    const numero = Number('XYZ'.indexOf(nif[0]) + nif.slice(1, 8))
    const ok = LETRAS_DNI[numero % 23] === nif[8]
    return { estado: ok ? 'valido' : 'incorrecto', tipo: 'NIE' }
  }

  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(nif)) {
    const digitos = nif.slice(1, 8).split('').map(Number)
    let suma = 0
    digitos.forEach((d, i) => {
      if (i % 2 === 1) suma += d
      else {
        const doble = d * 2
        suma += Math.floor(doble / 10) + (doble % 10)
      }
    })
    const control = (10 - (suma % 10)) % 10
    const letraControl = 'JABCDEFGHI'[control]
    const final = nif[8]
    let ok: boolean
    if ('PQRSNW'.includes(nif[0])) ok = final === letraControl
    else if ('ABEH'.includes(nif[0])) ok = final === String(control)
    else ok = final === String(control) || final === letraControl
    return { estado: ok ? 'valido' : 'incorrecto', tipo: 'CIF' }
  }

  return { estado: 'desconocido' }
}

/** Deja solo los dígitos de un teléfono español (sin prefijo +34). */
export function limpiarTelefono(valor: string): string {
  const digitos = valor.replace(/[^\d+]/g, '')
  return digitos.replace(/^(\+34|0034)/, '')
}

export function esTelefonoEspanol(valor: string): boolean {
  return /^[6789]\d{8}$/.test(limpiarTelefono(valor))
}

export function esMovilEspanol(valor: string): boolean {
  return /^[67]\d{8}$/.test(limpiarTelefono(valor))
}

export function esEmail(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor.trim())
}

export function esCodigoPostal(valor: string): boolean {
  return /^(0[1-9]|[1-4]\d|5[0-2])\d{3}$/.test(valor.trim())
}
