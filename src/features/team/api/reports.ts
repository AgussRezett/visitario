import { queryOptions } from '@tanstack/react-query'
import { supabase, type Enums } from '@/lib/supabase'
import type { ReportDayVisit } from '@/domain/team-report'
import { toOperations } from '@/domain/operations'
import { REPORT_VISIT_SELECT } from '@/features/workday/api/selects'

type Row = {
  id: string
  workday_id: string
  merchandiser_id: string
  sort_order: number
  source: Enums<'visit_source'>
  work_status: Enums<'work_status'>
  review_status: Enums<'review_status'>
  store: { address: string; channel_id?: number | null } | null
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
      const [visits, metrics, ops] = await Promise.all([
        supabase.from('visit').select(REPORT_VISIT_SELECT).eq('company_id', companyId).eq('work_date', date).is('deleted_at', null).order('sort_order'),
        supabase.from('daily_metrics').select('merchandiser_id, metric_id, quantity').eq('company_id', companyId).eq('work_date', date),
        supabase.rpc('day_operations', { p_company: companyId, p_date: date }),
      ])
      if (ops.error) throw ops.error
      if (visits.error) throw visits.error
      if (metrics.error) throw metrics.error
      const totals: TeamReportData['metrics'] = {}
      for (const m of metrics.data) {
        if (!m.merchandiser_id || m.metric_id === null) continue
        ;(totals[m.merchandiser_id] ??= {})[m.metric_id] = m.quantity ?? 0
      }
      const rows = (visits.data as unknown as Row[]).sort((a, b) => a.sort_order - b.sort_order)
      const toVisit = (v: Row, merchandiserId: string): ReportDayVisit => ({
        merchandiserId, address: v.store?.address ?? '', added: v.source === 'added', workStatus: v.work_status, reviewStatus: v.review_status, channelId: v.store?.channel_id ?? null,
      })
      // An operativo's visits are in each member's report too (they are in the host's day).
      const shared = toOperations(ops.data).flatMap((o) =>
        o.members.filter((m) => m.personId !== o.hostId).flatMap((m) => rows.filter((v) => v.workday_id === o.workdayId).map((v) => toVisit(v, m.personId))),
      )
      return { visits: [...rows.map((v) => toVisit(v, v.merchandiser_id)), ...shared], metrics: totals }
    },
  })
