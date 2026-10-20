// The team's day for the supervisor's reports (wireframes S08, SM08): one row per
// merchandiser, the team's totals, and each one's daily report in the WhatsApp format.
import { formatDayMonth } from './dates'
import { buildDailyReport, type ReportMetric } from './report'
import { isVisited, type ReviewStatus, type WorkStatus } from './visit'

export interface ReportDayVisit {
  merchandiserId: string
  address: string
  added: boolean
  workStatus: WorkStatus
  reviewStatus: ReviewStatus
  /** The store's channel id, named with the catalogs. */
  channelId?: number | null
}

export interface MemberDay {
  personId: string
  name: string
  total: number
  visited: number
  notVisited: number
  extras: number
  refused: number
  approved: number
  toReview: number
  needsFix: number
  /** metric id → total */
  metrics: Record<number, number>
}

/** One merchandiser's numbers for the day. */
export function memberDay(person: { personId: string; name: string }, visits: readonly ReportDayVisit[], metrics: Record<number, number> = {}): MemberDay {
  const mine = visits.filter((v) => v.merchandiserId === person.personId)
  const done = mine.filter((v) => isVisited(v.workStatus))
  return {
    ...person,
    total: mine.length,
    visited: done.length,
    notVisited: mine.length - done.length,
    extras: done.filter((v) => v.added).length,
    refused: mine.filter((v) => v.workStatus === 'refused').length,
    approved: mine.filter((v) => v.reviewStatus === 'approved').length,
    toReview: done.filter((v) => v.reviewStatus === 'unreviewed').length,
    needsFix: mine.filter((v) => v.reviewStatus === 'needs_fix').length,
    metrics,
  }
}

/** The team's totals: the last row of the table. */
export function teamTotals(rows: readonly MemberDay[]): Omit<MemberDay, 'personId' | 'name'> {
  const sum = (pick: (r: MemberDay) => number) => rows.reduce((n, r) => n + pick(r), 0)
  const metrics: Record<number, number> = {}
  for (const r of rows) for (const [id, q] of Object.entries(r.metrics)) metrics[Number(id)] = (metrics[Number(id)] ?? 0) + q
  return {
    total: sum((r) => r.total),
    visited: sum((r) => r.visited),
    notVisited: sum((r) => r.notVisited),
    extras: sum((r) => r.extras),
    refused: sum((r) => r.refused),
    approved: sum((r) => r.approved),
    toReview: sum((r) => r.toReview),
    needsFix: sum((r) => r.needsFix),
    metrics,
  }
}

export type ReviewTone = 'approved' | 'pending' | 'fix' | 'none'

/** The review chip: corrections first, then what is left to review, then approvals. */
export function reviewSummary(r: Pick<MemberDay, 'approved' | 'toReview' | 'needsFix'>): { tone: ReviewTone; label: string } {
  if (r.needsFix) return { tone: 'fix', label: r.needsFix === 1 ? '1 corrección' : `${r.needsFix} correcciones` }
  if (r.toReview) return { tone: 'pending', label: `${r.toReview} sin revisar` }
  if (r.approved) return { tone: 'approved', label: r.approved === 1 ? '1 aprobada' : `${r.approved} aprobadas` }
  return { tone: 'none', label: 'Sin visitas terminadas' }
}

/** One merchandiser's report, as they would send it (same template as theirs). */
export function memberReport(input: { date: string; personId: string; visits: readonly ReportDayVisit[]; metrics: readonly ReportMetric[]; template: string; channelName?: (id: number | null | undefined) => string | null }) {
  const visits = input.visits
    .filter((v) => v.merchandiserId === input.personId)
    .map((v) => ({ address: v.address, added: v.added, workStatus: v.workStatus, channel: input.channelName?.(v.channelId) ?? null }))
  return buildDailyReport({ date: input.date, visits, metrics: [...input.metrics], template: input.template })
}

/** Everyone's reports in one text, each under its name. */
export function teamReport(date: string, reports: readonly { name: string; text: string }[]) {
  const parts = reports.map((r) => `*${r.name.toUpperCase()}*\n${r.text.trim()}`)
  return [`INFORME DEL EQUIPO ${formatDayMonth(date)}`, ...parts].join('\n\n')
}
