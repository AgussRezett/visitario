import { queryOptions } from '@tanstack/react-query'
import { supabase, type Enums } from '@/lib/supabase'
import type { ReportDayVisit } from '@/domain/team-report'
import { REPORT_VISIT_SELECT } from '@/features/workday/api/selects'

type Row = {
  id: string
  merchandiser_id: string
  sort_order: number
  source: Enums<'visit_source'>
  work_status: Enums<'work_status'>
  review_status: Enums<'review_status'>
  store: { address: string } | null
}

export interface TeamReportData {
  visits: ReportDayVisit[]
  /** merchandiser → metric id → total */
  metrics: Record<string, Record<number, number>>
}

/** Every visit of the team that day (RLS: the supervisor's team) and their work totals. */
export const teamReportQuery = (companyId: string, date: string) =>
  queryOptions({
    queryKey: ['team', 'report', companyId, date] as const,
    queryFn: async (): Promise<TeamReportData> => {
      const [visits, metrics] = await Promise.all([
        supabase.from('visit').select(REPORT_VISIT_SELECT).eq('company_id', companyId).eq('work_date', date).is('deleted_at', null).order('sort_order'),
        supabase.from('daily_metrics').select('merchandiser_id, metric_id, quantity').eq('company_id', companyId).eq('work_date', date),
      ])
      if (visits.error) throw visits.error
      if (metrics.error) throw metrics.error
      const totals: TeamReportData['metrics'] = {}
      for (const m of metrics.data) {
        if (!m.merchandiser_id || m.metric_id === null) continue
        ;(totals[m.merchandiser_id] ??= {})[m.metric_id] = m.quantity ?? 0
      }
      return {
        visits: (visits.data as unknown as Row[])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((v) => ({ merchandiserId: v.merchandiser_id, address: v.store?.address ?? '', added: v.source === 'added', workStatus: v.work_status, reviewStatus: v.review_status })),
        metrics: totals,
      }
    },
  })
