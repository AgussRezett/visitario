import { describe, expect, it } from 'vitest'
import { distribution, effectiveRapport, weeksBetween, groupBy, indexOf, lastWeeks, levelOf, scoreOf, toStoreReputation, trendOf, weekly, weekStart, type RapportFact } from './reputation'

describe('a store’s level', () => {
  it('the average of points, back to a level', () => {
    expect(levelOf(3)).toBe('welcoming')
    expect(levelOf(2.4)).toBe('restricted')
    expect(levelOf(1)).toBe('indifferent')
    expect(levelOf(0.4)).toBe('unwilling')
    expect(indexOf(2.25)).toBe(75)
  })

  it('the trend: the last 3 against the 3 before', () => {
    expect(trendOf(1, 2.67)).toBe('worse')
    expect(trendOf(3, 2)).toBe('better')
    expect(trendOf(2.33, 2)).toBe('steady')
    expect(trendOf(2, null)).toBe('new')
  })

  it('from store_reputation (numbers come as text)', () => {
    expect(toStoreReputation({ store_id: 's1', score: '1.40', recent: '1.00', previous: '2.00', rated: 5, last_rated: '2026-10-16' })).toEqual({
      storeId: 's1', level: 'indifferent', score: 1.4, trend: 'worse', rated: 5, lastRated: '2026-10-16',
    })
    expect(toStoreReputation({ store_id: 's1', score: null, recent: null, previous: null, rated: 0, last_rated: null })).toBeNull()
  })
})

const f = (week: string, storeId: string, merchandiserId: string, rapport: RapportFact['rapport'], visits = 1, area: string | null = 'Belgrano'): RapportFact => ({
  week, storeId, storeName: storeId, area, merchandiserId, merchandiserName: merchandiserId, rapport, visits,
})

describe('the dashboard', () => {
  const facts = [
    f('2026-10-05', 's1', 'agus', 'welcoming', 3),
    f('2026-10-05', 's2', 'agus', 'restricted'),
    f('2026-10-12', 's1', 'lucia', 'unwilling', 2, 'Paternal'),
    f('2026-10-12', 's3', 'lucia', 'welcoming', 1, 'Paternal'),
  ]

  it('distribution and score', () => {
    const d = distribution(facts)
    expect(d).toEqual({ welcoming: 4, restricted: 1, indifferent: 0, unwilling: 2 })
    expect(scoreOf(d)).toBeCloseTo(14 / 7)
    expect(scoreOf(distribution([]))).toBeNull()
  })

  it('every week of the period, empty ones included', () => {
    const w = weekly(facts, ['2026-09-28', '2026-10-05', '2026-10-12'])
    expect(w.map((x) => x.d.welcoming)).toEqual([0, 3, 1])
  })

  it('by merchandiser or area, worst first', () => {
    const byPerson = groupBy(facts, (x) => ({ id: x.merchandiserId, label: x.merchandiserName }))
    expect(byPerson.map((g) => g.id)).toEqual(['lucia', 'agus'])
    expect(byPerson[0]).toMatchObject({ total: 3, stores: 2 })
    const byArea = groupBy(facts, (x) => ({ id: x.area ?? '', label: x.area ?? 'Sin zona' }))
    expect(byArea.map((g) => g.label)).toEqual(['Paternal', 'Belgrano'])
  })

  it('weeks start on Monday, like the database', () => {
    expect(weekStart('2026-10-17')).toBe('2026-10-12') // Saturday
    expect(weekStart('2026-10-12')).toBe('2026-10-12')
    expect(weekStart('2026-10-18')).toBe('2026-10-12') // Sunday
    expect(lastWeeks('2026-10-17', 3)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12'])
    expect(weeksBetween('2026-09-18', '2026-10-17')).toEqual(['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'])
  })
})

describe('a visit’s rating', () => {
  it('the one marked, or "no quiso" when the store did not authorize', () => {
    expect(effectiveRapport({ rapport: 'restricted', consent: 'yes' })).toBe('restricted')
    expect(effectiveRapport({ rapport: null, consent: 'refused' })).toBe('unwilling')
    expect(effectiveRapport({ rapport: null, consent: 'yes' })).toBeNull()
    expect(effectiveRapport({ rapport: null, consent: 'closed' })).toBeNull()
  })
})
