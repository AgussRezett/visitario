import { useEffect } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { weekOf } from '@/domain/dates'
import { workdayKeys } from './keys'
import { toVisit, toWorkday, WORKDAY_SELECT, type VisitRow, type WorkdaySummary } from './queries'
import { VISIT_SELECT } from './selects'

/** A day loaded less than this ago is not asked again. */
const FRESH_MS = 60_000

/**
 * Loads the days of the visible week in the background, so moving between them is instant:
 * one request for the week's workdays and one for their stops (not one per day), and only
 * again when the week or its workdays change (not on every refresh of the history).
 */
export function usePrefetchWeek(companyId: string, personId: string, date: string, days: WorkdaySummary[] | undefined) {
  const qc = useQueryClient()
  const week = weekOf(date)
  const known = (days ?? []).filter((d) => week.includes(d.workDate)).map((d) => d.id).sort().join(',')
  const weekStart = week[0] ?? date
  useEffect(() => {
    if (!companyId || !personId) return
    void prefetchWeek(qc, companyId, personId, weekOf(weekStart), known ? known.split(',') : [])
  }, [qc, companyId, personId, weekStart, known])
}

const isFresh = (qc: QueryClient, key: readonly unknown[]) => (qc.getQueryState(key)?.dataUpdatedAt ?? 0) > Date.now() - FRESH_MS

async function prefetchWeek(qc: QueryClient, companyId: string, personId: string, week: string[], workdayIds: string[]) {
  const days = week.filter((d) => !isFresh(qc, workdayKeys.day(companyId, d)))
  const stops = workdayIds.filter((id) => !isFresh(qc, workdayKeys.visits(id)))
  const [workdays, visits] = await Promise.all([
    days.length
      ? supabase.from('workday').select(WORKDAY_SELECT).eq('company_id', companyId).eq('merchandiser_id', personId).in('work_date', days).is('deleted_at', null)
      : null,
    stops.length
      ? supabase.from('visit').select(VISIT_SELECT).in('workday_id', stops).is('deleted_at', null).order('sort_order')
      : null,
  ])
  // A day that changed meanwhile (opened, refreshed) keeps what it has.
  if (workdays && !workdays.error) {
    for (const d of days) {
      if (isFresh(qc, workdayKeys.day(companyId, d))) continue
      const row = workdays.data.find((w) => w.work_date === d)
      qc.setQueryData(workdayKeys.day(companyId, d), row ? toWorkday(row, personId) : null)
    }
  }
  if (visits && !visits.error) {
    const rows = visits.data as unknown as (VisitRow & { workday_id: string })[]
    for (const id of stops) {
      if (isFresh(qc, workdayKeys.visits(id))) continue
      qc.setQueryData(workdayKeys.visits(id), rows.filter((r) => r.workday_id === id).map((r) => toVisit(r, personId)))
    }
  }
}
