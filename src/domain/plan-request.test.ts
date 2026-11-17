import { describe, expect, it } from 'vitest'
import { understand, type PlanCatalog } from './plan-request'

const cat: PlanCatalog = {
  sellers: [{ id: 1, name: 'Mirko Ra' }, { id: 2, name: 'Ruth Ri' }],
  channels: [{ id: 10, name: 'Autoservicio' }],
  zones: [{ id: 'z1', name: 'Palermo Norte' }],
  areas: ['Palermo', 'Villa Urquiza'],
  people: [{ personId: 'p2', firstName: 'Lucía', lastName: 'Gómez' }, { personId: 'p3', firstName: 'Diego', lastName: 'Paz' }],
}
const TODAY = '2026-11-17'

describe('a route asked for in words', () => {
  it('keeps what the lists have, and says it back', () => {
    const u = understand({
      goal: 'overdue', seller_ids: [1], areas: ['palermo'], zone_id: 'z1', min_rapport: 'welcoming',
      stale_days: 31, count: 14, mode: 'walking', merchandiser: 'lucia', date: '2026-11-18',
    }, cat, TODAY)
    expect(u).toMatchObject({ goal: 'overdue', sellerIds: [1], areas: ['Palermo'], zoneId: 'z1', minRapport: 2.5, staleDays: 30, count: 14, mode: 'walking', personId: 'p2', date: '2026-11-18', unknown: [] })
    expect(u.chips).toEqual([
      'Objetivo: Los más atrasados', 'Vendedor: Mirko Ra', 'Barrio: Palermo', 'Zona: Palermo Norte', 'Trato: Buena onda',
      'Sin activar hace más de 30 días', '14 locales', 'A pie', 'Para: Lucía Gómez', 'Día: miércoles 18 de noviembre',
    ])
  })

  it('nothing made up gets through: unknown ids, areas, people, past days', () => {
    const u = understand({ goal: 'fastest', seller_ids: [99, '1'], areas: ['Recoleta'], zone_id: 'z9', merchandiser: 'Pedro', date: '2026-11-01', unknown: ['cerca del subte'] }, cat, TODAY)
    expect(u).toMatchObject({ goal: null, sellerIds: [], areas: [], zoneId: null, personId: null, date: null })
    expect(u.unknown).toEqual(['cerca del subte', 'el activador "Pedro"'])
    expect(u.chips).toEqual([])
  })

  it('"nunca visitados" is its own filter; a count is kept as asked, up to what a route holds', () => {
    const u = understand({ stale_days: 'never', count: 40 }, cat, TODAY)
    expect(u).toMatchObject({ staleDays: Number.POSITIVE_INFINITY, count: 25 })
    expect(u.chips).toEqual(['Nunca activados', '25 locales'])
  })

  it('an answer that is not one is nothing', () => {
    expect(understand(null, cat, TODAY)).toMatchObject({ goal: null, chips: [], unknown: [] })
    expect(understand('hola', cat, TODAY).chips).toEqual([])
  })
})
