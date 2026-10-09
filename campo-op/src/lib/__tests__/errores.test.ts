import { describe, expect, it } from 'vitest'
import { mensajeDeError, mensajeDeErrorSubida } from '../errores'

describe('mensajes de error en español', () => {
  it('traduce los errores de subida de fotos', () => {
    expect(mensajeDeErrorSubida({ statusCode: '403', message: 'new row violates row-level security policy' })).toMatch(/No tienes permiso/)
    expect(mensajeDeErrorSubida({ status: 413 })).toMatch(/demasiado grande/)
    expect(mensajeDeErrorSubida({ statusCode: 415 })).toMatch(/formato/)
    expect(mensajeDeErrorSubida({ statusCode: 500, message: 'Internal' })).toMatch(/no ha aceptado/)
    expect(mensajeDeErrorSubida(new TypeError('Failed to fetch'))).toMatch(/No hay conexión/)
  })

  it('traduce los errores de la base de datos', () => {
    expect(mensajeDeError({ code: '23505', message: 'duplicate key' })).toBe('Ya existe un registro con ese código.')
    expect(mensajeDeError({ code: '42501', message: 'permission denied' })).toBe('No tienes permiso para hacer esto.')
    expect(mensajeDeError({ code: '42501', message: 'Solo un administrador puede eliminar este registro' })).toMatch(/^Solo un administrador/)
    expect(mensajeDeError(new TypeError('Failed to fetch'))).toMatch(/No hay conexión/)
  })
})
