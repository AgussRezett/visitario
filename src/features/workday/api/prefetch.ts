import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { weekOf } from '@/domain/dates'
import { visitsQuery, workdayQuery, type WorkdaySummary } from './queries'

/** Loads the days of the visible week in the background, so moving between them is instant. */
export function usePrefetchWeek(companyId: string, personId: string, date: string, days: WorkdaySummary[] | undefined) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!companyId || !personId) return
    for (const d of weekOf(date)) {
      void qc.prefetchQuery({ ...workdayQuery(companyId, personId, d), staleTime: 60_000 })
      const known = days?.find((x) => x.workDate === d)
      if (known) void qc.prefetchQuery({ ...visitsQuery(known.id, personId), staleTime: 60_000 })
    }
  }, [qc, companyId, personId, date, days])
}
