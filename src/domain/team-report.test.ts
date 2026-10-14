import { describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATES } from './templates'
import { memberDay, memberReport, reviewSummary, teamReport, teamTotals, type ReportDayVisit } from './team-report'

const v = (merchandiserId: string, address: string, workStatus: ReportDayVisit['workStatus'], extra: Partial<ReportDayVisit> = {}): ReportDayVisit => ({
  merchandiserId, address, workStatus, added: false, reviewStatus: 'unreviewed', ...extra,
})

const day: ReportDayVisit[] = [
  v('agus', 'Amenábar 1260', 'done', { reviewStatus: 'approved' }),
  v('agus', 'Vidal 2044', 'closed', { reviewStatus: 'approved' }),
  v('agus', 'Echeverría 1580', 'pending'),
  v('agus', 'Cabildo 2280', 'done', { added: true }),
  v('lucia', 'Moldes 1365', 'refused', { reviewStatus: 'needs_fix' }),
  v('lucia', 'Juramento 2101', 'done'),
]

describe('each merchandiser', () => {
  it('visited (closed and refused count), not visited, extras, refused and review', () => {
    expect(memberDay({ personId: 'agus', name: 'Agus' }, day, { 1: 10 })).toEqual({
      personId: 'agus', name: 'Agus', total: 4, visited: 3, notVisited: 1, extras: 1, refused: 0, approved: 2, toReview: 1, needsFix: 0, metrics: { 1: 10 },
    })
    expect(memberDay({ personId: 'lucia', name: 'Lucía' }, day)).toMatchObject({ total: 2, visited: 2, refused: 1, needsFix: 1, toReview: 1 })
  })

  it('someone without visits that day', () => {
    expect(memberDay({ personId: 'diego', name: 'Diego' }, day)).toMatchObject({ total: 0, visited: 0, notVisited: 0 })
  })
})

describe('the team', () => {
  it('adds up every row, numbers of work included', () => {
    const rows = [memberDay({ personId: 'agus', name: 'Agus' }, day, { 1: 10, 2: 7 }), memberDay({ personId: 'lucia', name: 'Lucía' }, day, { 1: 8 })]
    expect(teamTotals(rows)).toMatchObject({ total: 6, visited: 5, notVisited: 1, extras: 1, refused: 1, metrics: { 1: 18, 2: 7 } })
  })

  it('review: corrections first, then pending, then approved', () => {
    expect(reviewSummary({ approved: 3, toReview: 2, needsFix: 1 })).toEqual({ tone: 'fix', label: '1 corrección' })
    expect(reviewSummary({ approved: 3, toReview: 2, needsFix: 0 })).toEqual({ tone: 'pending', label: '2 sin revisar' })
    expect(reviewSummary({ approved: 14, toReview: 0, needsFix: 0 })).toEqual({ tone: 'approved', label: '14 aprobadas' })
    expect(reviewSummary({ approved: 0, toReview: 0, needsFix: 0 }).tone).toBe('none')
  })
})

describe('report texts', () => {
  const metrics = [{ name: 'Kits', reportLabel: 'CUANTOS KIT DE BOLSAS ARME', total: 10 }]

  it("a merchandiser's report is the one they send", () => {
    const text = memberReport({ date: '2026-10-09', personId: 'agus', visits: day, metrics, template: DEFAULT_TEMPLATES.daily_report })
    expect(text).toContain('RESUMEN DEL DIA 09/10')
    expect(text).toContain('CUANTOS CLIENTES VISITE: 3')
    expect(text).toContain('CUANTOS KIT DE BOLSAS ARME: 10')
    expect(text).toContain('Vidal 2044 (cerrado)')
    expect(text).not.toContain('Moldes 1365')
  })

  it("the team's report puts each one under its name", () => {
    expect(teamReport('2026-10-09', [{ name: 'Agus', text: 'A\n' }, { name: 'Lucía', text: 'L' }])).toBe('INFORME DEL EQUIPO 09/10\n\n*AGUS*\nA\n\n*LUCÍA*\nL')
  })
})
