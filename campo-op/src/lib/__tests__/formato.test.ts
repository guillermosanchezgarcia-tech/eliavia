import { describe, expect, it } from 'vitest'
import { coincide, comparar, formatearFecha, formatearHa, formatearM2, haceCuanto, haceDias, iniciales, normalizar } from '../formato'

describe('formato', () => {
  it('busca sin tildes ni mayúsculas y en cualquier orden', () => {
    expect(normalizar('  Níjar ')).toBe('nijar')
    expect(coincide('Agrícola Pérez SL · El Ejido', 'perez ejido')).toBe(true)
    expect(coincide('Agrícola Pérez SL', 'pérez níjar')).toBe(false)
  })

  it('formatea fechas y superficies al estilo español', () => {
    expect(formatearFecha('2026-10-07')).toBe('07/10/2026')
    expect(formatearFecha(null)).toBe('')
    expect(formatearHa(1.23456)).toBe('1,23 ha')
    expect(formatearHa(1234.5)).toBe('1234,5 ha')
    expect(formatearM2(1.2345)).toBe('12.345 m²')
  })

  it('dice hace cuánto pasó algo', () => {
    const ahora = Date.parse('2026-10-07T12:00:00Z')
    expect(haceCuanto('2026-10-07T11:59:50Z', ahora)).toBe('ahora mismo')
    expect(haceCuanto('2026-10-07T11:55:00.123456+00:00', ahora)).toBe('hace 5 minutos')
    expect(haceCuanto(null)).toBe('nunca')
  })

  it('saca las iniciales y ordena con números', () => {
    expect(iniciales('Agrícola Pérez SL')).toBe('AP')
    expect(iniciales('José de la Torre')).toBe('JT')
    expect(['10', '2', '1'].sort(comparar)).toEqual(['1', '2', '10'])
  })

  it('cuenta los días desde una visita', () => {
    const hoy = '2026-10-07'
    expect(haceDias('2026-10-07', hoy)).toBe('hoy')
    expect(haceDias('2026-10-06', hoy)).toBe('ayer')
    expect(haceDias('2026-09-25', hoy)).toBe('hace 12 días')
    expect(haceDias('2026-05-07', hoy)).toBe('hace 5 meses')
    expect(haceDias('2024-01-01', hoy)).toBe('hace 3 años')
    expect(haceDias(null, hoy)).toBe('')
  })
})
