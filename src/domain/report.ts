import { formatDayMonth } from './dates'
import { fillTemplate } from './templates'
import { isVisited, type WorkStatus } from './visit'

export interface ReportVisit {
  address: string
  added: boolean // added by the merchandiser (an "extra")
  workStatus: WorkStatus
}

export interface ReportMetric {
  name: string
  reportLabel: string | null
  total: number
}

const SUFFIX: Partial<Record<WorkStatus, string>> = { closed: ' (cerrado)', refused: ' (no autorizó)' }
const list = (lines: string[]) => (lines.length ? lines.join('\n') : '-')

/** Numbers for the report cards. */
export function reportTotals(visits: ReportVisit[]) {
  return {
    visited: visits.filter((v) => isVisited(v.workStatus)).length,
    extras: visits.filter((v) => v.added && isVisited(v.workStatus)).length,
    notVisited: visits.filter((v) => !isVisited(v.workStatus)).length,
  }
}

/**
 * The daily report in the format sent by WhatsApp today:
 * visited = assigned stores with a result; extras = added ones with a result;
 * not visited = anything still pending. Closed and not authorized count as visited.
 */
export function buildDailyReport(input: { date: string; visits: ReportVisit[]; metrics: ReportMetric[]; template: string }) {
  const line = (v: ReportVisit) => `${v.address}${SUFFIX[v.workStatus] ?? ''}`
  const done = input.visits.filter((v) => isVisited(v.workStatus))
  return fillTemplate(input.template, {
    date: formatDayMonth(input.date),
    visited_count: done.length,
    metrics: input.metrics
      .filter((m) => m.reportLabel)
      .map((m) => `${m.reportLabel}: ${m.total}`)
      .join('\n'),
    visited: list(done.filter((v) => !v.added).map(line)),
    not_visited: list(input.visits.filter((v) => !isVisited(v.workStatus)).map(line)),
    added: list(done.filter((v) => v.added).map(line)),
  })
}
