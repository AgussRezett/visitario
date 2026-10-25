import { describe, expect, it } from 'vitest'
import { daysBetween } from './dates'
import { applyFilters, convexHull, insights, NO_FILTERS, NONE_COLOR, painter, recencyOf, ringArcs, ringSize, SERIES, zoneOf, type MapPoint } from './store-map'

const TODAY = '2026-10-25'
const p = (id: string, extra: Partial<MapPoint> = {}): MapPoint => ({
  id, name: null, address: `Calle ${id}`, area: 'Belgrano', customerNumber: null, lat: -34.56, lng: -58.46, channelId: null, sellerId: null,
  lastVisitDate: null, lastMerchandiser: null, visits30: 0, visits90: 0, rapport: null, ...extra,
})
const sellers = [{ id: 10, name: 'Florencia' }, { id: 11, name: 'Pedro' }]

describe('store map', () => {
  it('counts days and bands the last activation', () => {
    expect(daysBetween('2026-10-01', TODAY)).toBe(24)
    expect(recencyOf(p('a', { lastVisitDate: '2026-10-20' }), TODAY)).toEqual({ band: 'recent', days: 5 })
    expect(recencyOf(p('a', { lastVisitDate: '2026-10-01' }), TODAY).band).toBe('month')
    expect(recencyOf(p('a', { lastVisitDate: '2026-08-01' }), TODAY).band).toBe('stale')
    expect(recencyOf(p('a'), TODAY)).toEqual({ band: 'never', days: null })
  })

  it('a seller keeps their color whatever is filtered; no seller is gray', () => {
    const { color, legend } = painter('seller', TODAY, sellers, [])
    expect(color(p('a', { sellerId: 11 }))).toBe(SERIES[1])
    expect(color(p('a'))).toBe(NONE_COLOR)
    expect(legend.map((l) => l.label)).toEqual(['Florencia', 'Pedro', 'Sin vendedor'])
  })

  it('filters by area, seller ("without" too), channel, stale and text', () => {
    const pts = [p('a', { sellerId: 10, area: 'Belgrano', lastVisitDate: '2026-10-24', visits30: 1 }), p('b', { area: 'Palermo', name: 'Coto Cabildo' }), p('c', { sellerId: 11, channelId: 3 })]
    expect(applyFilters(pts, { ...NO_FILTERS, sellerId: 0 }, TODAY).map((x) => x.id)).toEqual(['b'])
    expect(applyFilters(pts, { ...NO_FILTERS, area: 'Palermo' }, TODAY).map((x) => x.id)).toEqual(['b'])
    expect(applyFilters(pts, { ...NO_FILTERS, staleOnly: true }, TODAY).map((x) => x.id)).toEqual(['b', 'c'])
    expect(applyFilters(pts, { ...NO_FILTERS, query: 'coto' }, TODAY).map((x) => x.id)).toEqual(['b'])
    expect(applyFilters(pts, { ...NO_FILTERS, channelId: 3 }, TODAY).map((x) => x.id)).toEqual(['c'])
  })

  it('insights per seller and area: coverage, stale, average days', () => {
    const pts = [
      p('a', { sellerId: 10, visits30: 2, lastVisitDate: '2026-10-20', rapport: 3 }),
      p('b', { sellerId: 10, lastVisitDate: '2026-08-25' }),
      p('c', { sellerId: 11, area: 'Palermo' }),
      p('d', { lat: null, lng: null }),
    ]
    const i = insights(pts, sellers, TODAY)
    expect(i.total).toMatchObject({ points: 4, active: 1, coverage: 25, stale: 3 })
    expect(i.bySeller.find((g) => g.key === '10')).toMatchObject({ points: 2, active: 1, coverage: 50, stale: 1, avgDays: 33, rapport: 3 })
    expect(i.bySeller.map((g) => g.label)).toEqual(['Florencia', 'Pedro', 'Sin vendedor'])
    expect(i.byArea[0]).toMatchObject({ key: 'Belgrano', stale: 2 })
    expect(i.unlocated).toBe(1)
  })

  it('a zone wraps the seller’s points, also with one or two', () => {
    const hull = convexHull([[0, 0], [2, 0], [1, 1], [2, 2], [0, 2], [1, 3]])
    expect(hull[0]).toEqual(hull[hull.length - 1])
    expect(hull).not.toContainEqual([1, 1])
    expect(zoneOf([[-58.46, -34.56]]).length).toBeGreaterThan(4)
    expect(zoneOf([])).toEqual([])
  })
})

describe('groups of points', () => {
  it('each point counts under its legend entry', () => {
    const { keyOf } = painter('seller', TODAY, sellers, [])
    expect(keyOf(p('a', { sellerId: 11 }))).toBe('11')
    expect(keyOf(p('a'))).toBe('none')
    expect(painter('recency', TODAY, sellers, []).keyOf(p('a', { lastVisitDate: '2026-10-20' }))).toBe('recent')
  })
  it('a ring has one arc per color with points, sized by share', () => {
    const arcs = ringArcs([{ color: 'blue', count: 3 }, { color: 'gray', count: 1 }, { color: 'red', count: 0 }], 20, 6)
    expect(arcs.map((a) => a.color)).toEqual(['blue', 'gray'])
    expect(arcs[0]?.d).toContain(' 0 1 1 ') // three quarters: the large arc
    expect(arcs[1]?.d).toContain(' 0 0 1 ')
    expect(ringArcs([{ color: 'blue', count: 5 }], 20, 6)).toHaveLength(1)
    expect(ringArcs([], 20, 6)).toEqual([])
  })
  it('bigger groups are bigger, up to a limit', () => {
    expect(ringSize(2)).toBeLessThan(ringSize(20))
    expect(ringSize(10_000)).toBe(64)
  })
})
