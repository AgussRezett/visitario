import { describe, expect, it } from 'vitest'
import { backLabel, fromSearch, safeFrom } from './back'

describe('the way back', () => {
  it('says where it goes', () => {
    expect(backLabel('/s/today/p2?date=2026-11-03')).toBe('La jornada')
    expect(backLabel('/s/today')).toBe('Hoy en el equipo')
    expect(backLabel('/s/review?tab=to_review')).toBe('Revisión')
    expect(backLabel('/review/v1')).toBe('Revisión')
    expect(backLabel('/s/stores')).toBe('Directorio')
    expect(backLabel('/x')).toBe('Volver')
  })

  it('only goes back inside Visitario', () => {
    expect(safeFrom('/s/today')).toBe('/s/today')
    expect(safeFrom('//evil.example')).toBeUndefined()
    expect(safeFrom('https://evil.example')).toBeUndefined()
    expect(fromSearch({ from: 3 })).toEqual({})
  })
})
