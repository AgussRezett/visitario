import { describe, expect, it } from 'vitest'
import { breakdown, brandShare, byPerson, change, coverage, daily, filterFacts, heat, NO_FILTER, summarize, type Facts, type FactVisit } from './analytics'
import { project, trend } from './forecast'

const v = (id: string, extra: Partial<FactVisit> = {}): FactVisit => ({
  id, d: '2026-11-02', m: 'p1', s: `s-${id}`, src: 'assigned', ws: 'done', rs: 'approved', c: 'yes', r: null,
  a: '2026-11-02T13:00:00Z', f: '2026-11-02T13:20:00Z', res: false, area: 'Belgrano', ch: 1, se: 3, dt: 2, da: 1, ph: 4, ...extra,
})

const facts: Facts = {
  visits: [
    v('a'),
    v('b', { m: 'p2', ws: 'refused', c: 'refused', a: '2026-11-03T15:10:00Z', d: '2026-11-03', area: 'Palermo', ch: null }),
    v('c', { ws: 'closed', src: 'added', f: null }),
    v('d', { ws: 'pending', a: null, f: null }),
    v('e', { s: 's-a', a: '2026-11-03T12:00:00Z', f: '2026-11-03T12:40:00Z', d: '2026-11-03' }),
  ],
  metrics: [{ v: 'a', id: 1, q: 3 }, { v: 'e', id: 1, q: 2 }, { v: 'b', id: 2, q: 1 }],
  brands: [{ v: 'a', id: 9 }, { v: 'e', id: 9 }, { v: 'a', id: 8 }],
  stores: [
    { s: 's-a', name: 'Mas Ahorro', area: 'Belgrano', ch: 1, se: 3, last: '2026-11-03' },
    { s: 's-b', name: 'Lili', area: 'Palermo', ch: null, se: 3, last: '2026-10-01' },
    { s: 's-x', name: 'Nunca', area: null, ch: null, se: null, last: null },
  ],
  people: [{ id: 'p1', first: 'Lucía', last: 'Gómez' }, { id: 'p2', first: 'Diego', last: 'Paz' }],
}

describe('reports: summary', () => {
  it('counts what was planned, visited and activated, and how long in the store', () => {
    const s = summarize(facts)
    expect([s.planned, s.visited, s.done, s.refused, s.closed, s.pending]).toEqual([5, 4, 2, 1, 1, 1])
    expect(s.completion).toBeCloseTo(0.8)
    expect(s.effectiveness).toBeCloseTo(0.5)
    expect(s.minutes).toBe(30) // median of 20 and 40
    expect(s.extras).toBe(1)
    expect(s.metrics).toEqual({ 1: 5, 2: 1 })
    expect(s.rapport.unwilling).toBe(1) // a refusal counts as "no quiso"
    expect(s.stores).toBe(3)
  })

  it('compares with the period before', () => {
    expect(change(12, 10)).toBeCloseTo(0.2)
    expect(change(5, 0)).toBeNull()
  })

  it('filters by person, channel or zone, with their work', () => {
    const only = filterFacts(facts, { ...NO_FILTER, people: ['p2'] })
    expect(only.visits.map((x) => x.id)).toEqual(['b'])
    expect(only.metrics).toEqual([{ v: 'b', id: 2, q: 1 }])
    expect(filterFacts(facts, { ...NO_FILTER, areas: ['Palermo'] }).stores.map((s) => s.s)).toEqual(['s-b'])
    expect(filterFacts(facts, { ...NO_FILTER, areas: ['Palermo', 'Belgrano'] }).stores.map((s) => s.s)).toEqual(['s-a', 's-b'])
    expect(filterFacts(facts, { ...NO_FILTER, channels: [0] }).stores.map((s) => s.s)).toEqual(['s-b', 's-x'])
  })
})

describe('reports: series and slices', () => {
  it('one point a day, empty days included', () => {
    const d = daily(facts, { from: '2026-11-01', to: '2026-11-03' })
    expect(d.map((p) => p.date)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03'])
    expect(d[1]).toMatchObject({ done: 1, closed: 1, pending: 1, metrics: { 1: 3 } })
    expect(d[2]).toMatchObject({ done: 1, refused: 1, metrics: { 1: 2, 2: 1 } })
  })

  it('people, most visits first, with visits per day worked', () => {
    const rows = byPerson(facts)
    expect(rows.map((r) => r.personId)).toEqual(['p1', 'p2'])
    expect(rows[0]).toMatchObject({ visited: 3, done: 2, days: 2, perDay: 1.5 })
  })

  it('by channel, those without one together', () => {
    expect(breakdown(facts, 'ch').map((s) => [s.key, s.visited])).toEqual([['1', 3], ['', 1]])
  })

  it('arrivals by weekday and hour, in Argentina', () => {
    const grid = heat(facts)
    expect(grid[0]?.[10]).toBe(2) // Monday 10 h (13 UTC): two arrivals
    expect(grid[1]?.[12]).toBe(1) // Tuesday 12 h
    expect(grid[1]?.[9]).toBe(1)
  })

  it('coverage: what the team reached and what waits the longest', () => {
    const c = coverage(facts, { from: '2026-11-01', to: '2026-11-03' })
    expect([c.active, c.visited]).toEqual([3, 2]) // a refusal is a visit too
    expect(c.buckets.map((b) => b.count)).toEqual([1, 0, 0, 1, 1])
    expect(c.stale.map((s) => s.name)).toEqual(['Nunca', 'Lili'])
  })

  it('brands: of the visits done, how many had each', () => {
    expect(brandShare(facts)).toEqual([{ id: 9, visits: 2, share: 1 }, { id: 8, visits: 1, share: 0.5 }])
  })
})

describe('reports: estimates', () => {
  const week = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']
  it('projects the period at the pace of the days gone', () => {
    const s = week.map((date, i) => ({ date, value: i < 2 ? 10 : i === 2 ? 4 : 0 }))
    const p = project(s, '2026-11-04')
    // 24 so far + today 6 more to reach 10 + Thursday to Saturday × 10 (Sunday does not count)
    expect(p).toMatchObject({ actual: 24, projected: 60, rate: 10, remaining: 4 })
    expect(project(s, '2026-11-02')).toBeNull() // nothing to learn from yet
  })

  it('says where a series is heading', () => {
    const days = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']
    const up = days.map((date, i) => ({ date, value: 10 + i }))
    expect(trend(up, '2026-11-01')).toBeGreaterThan(0.3)
    expect(trend(up.slice(0, 6), '2026-11-01')).toBeNull() // too few days to say
    expect(trend(days.map((date) => ({ date, value: 0.2 })), '2026-11-01')).toBeNull() // too little a day
  })
})

describe('reports: quick reading', () => {
  it('says what changed, where it ends, what is wrong and who stands out', async () => {
    const { insights } = await import('./insights')
    const now = summarize(facts)
    const out = insights({
      now: { ...now, visited: 40, refused: 8 },
      before: { ...now, visited: 30 },
      projection: { actual: 40, projected: 90, low: 80, high: 100, rate: 6.5, remaining: 8 },
      trend: null,
      people: byPerson(facts).map((r) => ({ ...r, days: 3 })),
      names: (id) => (id === 'p1' ? 'Lucía' : 'Diego'),
      channels: [{ key: '1', visited: 10, done: 6, refused: 4, stores: 5 }],
      channelName: () => 'Autoservicio',
      coverage: coverage(facts, { from: '2026-11-01', to: '2026-11-03' }),
      heat: heat(facts),
    })
    const text = out.map((i) => i.text).join('\n')
    expect(text).toContain('subieron 33 %')
    expect(text).toContain('cierra con unas 90 visitas, entre 80 y 100')
    expect(text).toContain('el canal con más es Autoservicio (40 %)')
    expect(text).toContain('2 comercios del directorio llevan más de 30 días')
    expect(text).not.toContain('1 comercios')
    expect(text).toContain('Lucía es quien más visitas resuelve por día')
    expect(text).toContain('los lunes')
  })
})
