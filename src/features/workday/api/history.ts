import { queryOptions } from '@tanstack/react-query'
import type { Enums } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { toTeamVisit, type TeamVisit } from '@/features/team/api/queries'
import type { VisitWork } from '@/features/team/components/ReviewDetail'

// The store's history for the activador: the finished visits of a store of their day, by
// anyone, and each one in detail. Read only, through functions that hold the rule.

export interface PastVisit {
  id: string
  workDate: string
  merchandiser: string
  workStatus: Enums<'work_status'>
  consent: Enums<'consent_kind'> | null
  reviewStatus: Enums<'review_status'>
  displays: number
  afters: number
}

/** The store's past visits, seen from one of my visits (newest first). */
export const storeHistoryQuery = (visitId: string) =>
  queryOptions({
    queryKey: ['workday', 'store-history', visitId] as const,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PastVisit[]> => {
      const { data, error } = await supabase.rpc('store_history', { p_visit: visitId })
      if (error) throw error
      return (data ?? []).map((r) => ({
        id: r.id, workDate: r.work_date, merchandiser: r.merchandiser, workStatus: r.work_status, consent: r.consent,
        reviewStatus: r.review_status, displays: r.displays, afters: r.afters,
      }))
    },
  })

/** One of those visits in full, with its work. Null when it is not in my stores' history. */
export const pastVisitQuery = (visitId: string, personId: string) =>
  queryOptions({
    queryKey: ['workday', 'past-visit', visitId] as const,
    queryFn: async (): Promise<{ visit: TeamVisit; work: VisitWork } | null> => {
      const { data, error } = await supabase.rpc('history_visit', { p_visit: visitId })
      if (error) throw error
      if (!data) return null
      const row = data as unknown as Parameters<typeof toTeamVisit>[0] & { metrics: { metric_id: number; quantity: number }[]; brands: number[] }
      return {
        visit: toTeamVisit(row, personId),
        work: { metrics: Object.fromEntries(row.metrics.map((m) => [m.metric_id, m.quantity])), brands: row.brands },
      }
    },
  })
