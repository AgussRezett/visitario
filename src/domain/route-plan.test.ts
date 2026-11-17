import { describe, expect, it } from 'vitest'
import { chooseStops, countOptions, eligible, inZone, NEVER, NO_PLAN_FILTERS, priority, reasonsFor, startOf, unlocated, type Candidate } from './route-plan'

const TODAY = '2026-11-17'
// Around Palermo: 0.001° is about 100 m.
const store = (id: string, lng: number, lat: number, extra: Partial<Candidate> = {}): Candidate => ({
  id, name: null, address: `Calle ${id}`, area: 'Palermo', customerNumber: null, lat, lng, channelId: 1, sellerId: 7,
  lastVisitDate: '2026-11-10', lastMerchandiser: null, visits30: 1, visits90: 2, rapport: null,
  openRequest: false, requestBy: null, openIssues: 0, plannedFor: null, ...extra,
})

describe('the stores a route may take', () => {
  const zone: [number, number][] = [[-58.44, -34.59], [-58.42, -34.59], [-58.42, -34.57], [-58.44, -34.57]]

  it('a point inside a drawn zone, or not', () => {
    expect(inZone(-58.43, -34.58, zone)).toBe(true)
    expect(inZone(-58.40, -34.58, zone)).toBe(false)
  })

  it('filters: zone, seller, rating, days without activation, already planned, no location', () => {
    const all = [
      store('in', -58.43, -34.58),
      store('out', -58.40, -34.58),
      store('other-seller', -58.43, -34.58, { sellerId: 9 }),
      store('rated', -58.43, -34.58, { rapport: 2.8 }),
      store('stale', -58.43, -34.58, { lastVisitDate: '2026-09-01', rapport: 1 }),
      store('never', -58.43, -34.58, { lastVisitDate: null }),
      store('planned', -58.43, -34.58, { plannedFor: 'Lucía' }),
      store('nowhere', -58.43, -34.58, { lat: null }),
    ]
    const ids = (f = {}) => eligible(all, { ...NO_PLAN_FILTERS, ...f }, TODAY).map((c) => c.id)
    expect(ids()).toEqual(['in', 'out', 'other-seller', 'rated', 'stale', 'never'])
    expect(ids({ zone, sellerIds: [7] })).toEqual(['in', 'rated', 'stale', 'never'])
    expect(ids({ minRapport: 2.5 })).toEqual(['rated'])
    expect(ids({ staleDays: 30 })).toEqual(['stale', 'never'])
    expect(ids({ staleDays: NEVER })).toEqual(['never'])
    expect(ids({ includePlanned: true })).toContain('planned')
    // Taken by the filters but not on the map: said, so they can be placed; a zone cannot hold them.
    expect(unlocated(all, NO_PLAN_FILTERS, TODAY)).toBe(1)
    expect(unlocated(all, { ...NO_PLAN_FILTERS, sellerIds: [9] }, TODAY)).toBe(0)
    expect(unlocated(all, { ...NO_PLAN_FILTERS, zone }, TODAY)).toBe(0)
  })

  it('the count asked for is offered even when it is not one of the usual', () => {
    expect(countOptions(14)).toEqual([6, 8, 10, 12, 14, 15, 20, 25])
    expect(countOptions(12)).toEqual([6, 8, 10, 12, 15, 20, 25])
  })
})

describe('choosing a route for a goal', () => {
  it('each goal weighs what it asks for', () => {
    const fresh = store('a', 0, 0)
    expect(priority(store('n', 0, 0, { lastVisitDate: null }), 'overdue', TODAY)).toBe(1)
    expect(priority(fresh, 'overdue', TODAY)).toBeLessThan(0.1)
    expect(priority(store('r', 0, 0, { openRequest: true }), 'requests', TODAY)).toBeGreaterThan(priority(store('i', 0, 0, { openIssues: 1 }), 'requests', TODAY))
    expect(priority(store('g', 0, 0, { rapport: 3 }), 'rapport', TODAY)).toBeGreaterThan(priority(store('u', 0, 0), 'rapport', TODAY))
    expect(priority(fresh, 'most', TODAY)).toBe(1)
  })

  // A tight block of six stores, and three scattered far away.
  const block = [0, 1, 2, 3, 4, 5].map((i) => store(`b${i}`, -58.43 + i * 0.001, -34.58))
  const far = [store('f1', -58.30, -34.50), store('f2', -58.55, -34.70), store('f3', -58.36, -34.66)]
  const located = (cs: Candidate[]) => cs as (Candidate & { lat: number; lng: number })[]

  it('"most": the dense block, not the scattered ones', () => {
    const ids = chooseStops(located([...far, ...block]), 'most', 6, TODAY).map((c) => c.id).sort()
    expect(ids).toEqual(['b0', 'b1', 'b2', 'b3', 'b4', 'b5'])
  })

  it('"requests": the requested store comes in, with its closest neighbours', () => {
    const requested = store('req', -58.30, -34.50, { openRequest: true, requestBy: 'Mirko' })
    const near = [store('n1', -58.301, -34.50), store('n2', -58.302, -34.50)]
    const ids = chooseStops(located([...block, requested, ...near]), 'requests', 3, TODAY).map((c) => c.id).sort()
    expect(ids).toEqual(['n1', 'n2', 'req'])
  })

  it('fewer stores than asked: all of them, the most valuable first', () => {
    const cs = located([store('x', 0, 0), store('y', 0, 0, { lastVisitDate: null })])
    expect(chooseStops(cs, 'overdue', 10, TODAY).map((c) => c.id)).toEqual(['y', 'x'])
  })

  it('the same input gives the same route', () => {
    const cs = located([...far, ...block])
    expect(chooseStops(cs, 'overdue', 4, TODAY)).toEqual(chooseStops(cs, 'overdue', 4, TODAY))
  })

  it('starts at an end of the route', () => {
    expect(['b0', 'b5']).toContain(startOf(block as { id: string; lat: number; lng: number }[]))
  })
})

describe('why each stop', () => {
  it('in a few words', () => {
    expect(reasonsFor(store('a', 0, 0, { lastVisitDate: null, openRequest: true, requestBy: 'Mirko', openIssues: 2, rapport: 2.8 }), TODAY))
      .toEqual(['Nunca activado', 'Pedido de Mirko', '2 novedades abiertas', 'Trato: buena onda'])
    expect(reasonsFor(store('b', 0, 0, { lastVisitDate: '2026-09-18', plannedFor: 'Lucía' }), TODAY)).toEqual(['Sin activar hace 60 días', 'Ya está en la jornada de Lucía'])
    expect(reasonsFor(store('c', 0, 0, { lastVisitDate: '2026-11-16' }), TODAY)).toEqual(['Activado hace 1 día'])
  })
})
