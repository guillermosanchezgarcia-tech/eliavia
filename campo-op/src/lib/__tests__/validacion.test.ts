import { describe, expect, it } from 'vitest'
import { comprobarNif, esCodigoPostal, esEmail, esMovilEspanol, esTelefonoEspanol, limpiarNif, limpiarTelefono } from '../validacion'

describe('comprobarNif', () => {
  it('acepta DNI, NIE y CIF correctos', () => {
    expect(comprobarNif('12345678Z')).toEqual({ estado: 'valido', tipo: 'DNI' })
    expect(comprobarNif('12.345.678-z')).toEqual({ estado: 'valido', tipo: 'DNI' })
    expect(comprobarNif('X1234567L')).toEqual({ estado: 'valido', tipo: 'NIE' })
    expect(comprobarNif('A28015865')).toEqual({ estado: 'valido', tipo: 'CIF' })
    expect(comprobarNif('B04000006')).toEqual({ estado: 'valido', tipo: 'CIF' })
  })

  it('detecta erratas en la letra o el dígito de control', () => {
    expect(comprobarNif('12345678A')).toEqual({ estado: 'incorrecto', tipo: 'DNI' })
    expect(comprobarNif('X1234567A')).toEqual({ estado: 'incorrecto', tipo: 'NIE' })
    expect(comprobarNif('A28015866')).toEqual({ estado: 'incorrecto', tipo: 'CIF' })
    // Una sociedad anónima (A) siempre lleva número, no letra.
    expect(comprobarNif('A2801586E')).toEqual({ estado: 'incorrecto', tipo: 'CIF' })
  })

  it('no juzga documentos que no son españoles', () => {
    expect(comprobarNif('FR12345678901')).toEqual({ estado: 'desconocido' })
    expect(comprobarNif('')).toEqual({ estado: 'desconocido' })
  })

  it('limpia el formato', () => {
    expect(limpiarNif(' 12 345 678-z ')).toBe('12345678Z')
  })
})

describe('teléfonos, email y código postal', () => {
  it('reconoce teléfonos españoles con o sin prefijo', () => {
    expect(limpiarTelefono('+34 600 11 22 33')).toBe('600112233')
    expect(esTelefonoEspanol('950 123 456')).toBe(true)
    expect(esTelefonoEspanol('12345')).toBe(false)
    expect(esMovilEspanol('0034 712345678')).toBe(true)
    expect(esMovilEspanol('950123456')).toBe(false)
  })

  it('comprueba email y código postal', () => {
    expect(esEmail('socio@ejemplo.es')).toBe(true)
    expect(esEmail('socio@ejemplo')).toBe(false)
    expect(esCodigoPostal('04700')).toBe(true)
    expect(esCodigoPostal('4700')).toBe(false)
    expect(esCodigoPostal('99000')).toBe(false)
  })
})
