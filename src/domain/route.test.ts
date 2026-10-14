import { describe, expect, it } from 'vitest'
import { applyRouteOrder, approximateRoute, distanceKm, inRoute, mapsLegs, placeQuery, routeKm, type Stop } from './route'

// Along Cabildo, roughly south to north, about 500 m apart.
const line: Stop[] = Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, location: { lat: -34.57 + i * 0.0045, lng: -58.45 } }))
const at = (i: number) => line[i] as Stop
const shuffled = [3, 0, 5, 1, 4, 2].map(at)

describe('distance', () => {
  it('about 500 m between neighbours, 0 to itself', () => {
    expect(distanceKm(at(0).location, at(1).location)).toBeCloseTo(0.5, 1)
    expect(distanceKm(at(0).location, at(0).location)).toBe(0)
  })
})

describe('best order', () => {
  it('without a starting point, walks the line from one end', () => {
    const { ids, km } = approximateRoute({ stops: shuffled })
    expect([ids.join(), [...ids].reverse().join()]).toContain('s0,s1,s2,s3,s4,s5')
    expect(km).toBeCloseTo(2.5, 1)
  })

  it('from my location, starts with the nearest end', () => {
    const near5 = { lat: at(5).location.lat + 0.002, lng: -58.45 }
    expect(approximateRoute({ stops: shuffled, origin: near5 }).ids).toEqual(['s5', 's4', 's3', 's2', 's1', 's0'])
  })

  it('respects the first and the last store', () => {
    const { ids } = approximateRoute({ stops: shuffled, firstId: 's2', lastId: 's3' })
    expect(ids[0]).toBe('s2')
    expect(ids[ids.length - 1]).toBe('s3')
    expect(new Set(ids).size).toBe(6)
  })

  it('a last store equal to the first is ignored', () => {
    expect(approximateRoute({ stops: shuffled, firstId: 's2', lastId: 's2' }).ids[0]).toBe('s2')
  })

  it('14 stores in well under a second, with first and last kept', () => {
    const grid: Stop[] = Array.from({ length: 14 }, (_, i) => ({ id: `g${i}`, location: { lat: -34.6 + (i % 4) * 0.01, lng: -58.45 + Math.floor(i / 4) * 0.01 } }))
    const started = performance.now()
    const { ids, km } = approximateRoute({ stops: grid, firstId: 'g13', lastId: 'g0' })
    expect(performance.now() - started).toBeLessThan(500)
    expect(ids).toHaveLength(14)
    expect(ids[0]).toBe('g13')
    expect(ids[13]).toBe('g0')
    const byId = new Map(grid.map((s) => [s.id, s]))
    expect(km).toBeCloseTo(routeKm(ids.map((id) => byId.get(id) as Stop)), 6)
    expect(km).toBeLessThan(routeKm(grid))
  })

  it('nothing to order', () => {
    expect(approximateRoute({ stops: [] })).toEqual({ ids: [], km: 0 })
    expect(approximateRoute({ stops: [at(0)] }).ids).toEqual(['s0'])
  })
})

describe('what enters the route', () => {
  it('pending, started or closed (to come back); not finished, refused or approved', () => {
    expect(inRoute({ workStatus: 'pending', reviewStatus: 'unreviewed' })).toBe(true)
    expect(inRoute({ workStatus: 'in_progress', reviewStatus: 'needs_fix' })).toBe(true)
    expect(inRoute({ workStatus: 'closed', reviewStatus: 'unreviewed' })).toBe(true)
    expect(inRoute({ workStatus: 'done', reviewStatus: 'unreviewed' })).toBe(false)
    expect(inRoute({ workStatus: 'refused', reviewStatus: 'unreviewed' })).toBe(false)
    expect(inRoute({ workStatus: 'closed', reviewStatus: 'approved' })).toBe(false)
  })
})

describe('applying the order', () => {
  it('the routed visits take their own places; the rest stay', () => {
    const day = [
      { id: 'done', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
      { id: 'approved', sortOrder: 3 },
      { id: 'c', sortOrder: 4 },
    ]
    expect(applyRouteOrder(day, ['c', 'a', 'b'])).toEqual([
      { id: 'c', sortOrder: 1 },
      { id: 'a', sortOrder: 2 },
      { id: 'b', sortOrder: 4 },
    ])
    expect(applyRouteOrder(day, ['a', 'b', 'c'])).toEqual([])
  })
})

describe('Google Maps', () => {
  const places = ['A 1', 'B 2', 'C 3', 'D 4', 'E 5', 'F 6', 'G 7']

  it('on the phone, legs of 3 stops in between; each starts where the last ended', () => {
    const legs = mapsLegs(places, 'driving', { lat: -34.5, lng: -58.4 }, 4)
    expect(legs.map((l) => [l.from, l.to])).toEqual([[1, 4], [4, 7]])
    const first = new URL((legs[0]?.href ?? '')).searchParams
    expect(first.get('origin')).toBe('-34.5,-58.4')
    expect(first.get('waypoints')).toBe('A 1|B 2|C 3')
    expect(first.get('destination')).toBe('D 4')
    const second = new URL((legs[1]?.href ?? '')).searchParams
    expect(second.get('origin')).toBe('D 4')
    expect(second.get('waypoints')).toBe('E 5|F 6')
    expect(second.get('destination')).toBe('G 7')
  })

  it('on a computer, all in one; without my location Maps starts where you are', () => {
    const [leg, ...rest] = mapsLegs(places, 'walking', undefined, 10)
    expect(rest).toHaveLength(0)
    const p = new URL(leg?.href ?? '').searchParams
    expect(p.get('origin')).toBeNull()
    expect(p.get('travelmode')).toBe('walking')
    expect(p.get('waypoints')?.split('|')).toHaveLength(6)
  })

  it('looks a store up by address and neighbourhood', () => {
    expect(placeQuery({ address: 'Moldes 1365', area: 'Belgrano' })).toBe('Moldes 1365, Belgrano')
    expect(placeQuery({ address: 'Moldes 1365', area: null })).toBe('Moldes 1365')
  })
})
