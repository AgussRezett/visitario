import { describe, expect, it } from 'vitest'
import { titleFor } from './titles'

describe('tab titles', () => {
  it('name each section, so open tabs read apart', () => {
    expect(titleFor('/s/map', 'supervisor')).toBe('Mapa de puntos')
    expect(titleFor('/s/map', 'seller')).toBe('Mapa de clientes')
    expect(titleFor('/s/stores')).toBe('Directorio')
    expect(titleFor('/s/reports')).toBe('Reportes')
    expect(titleFor('/s/workday')).toBe('Mi jornada')
    expect(titleFor('/s/today/p2')).toBe('Jornada del activador')
    expect(titleFor('/s/users/new')).toBe('Invitar a alguien')
  })

  it('and the pages outside the sections', () => {
    expect(titleFor('/review/v1')).toBe('Revisión')
    expect(titleFor('/stores/s1')).toBe('Comercio')
    expect(titleFor('/profile')).toBe('Mi perfil')
    expect(titleFor('/')).toBeNull()
  })
})
