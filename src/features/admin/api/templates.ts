import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { DEFAULT_TEMPLATES, type TemplateKind } from '@/domain/templates'
import { TEAM_VISIT_SELECT } from '@/features/workday/api/selects'
import { toTeamVisit, type TeamVisit } from '@/features/team/api/queries'

/** The company's templates (Visitario's default where it has none). */
export const templatesQuery = (companyId: string) =>
  queryOptions({
    queryKey: ['admin', 'templates', companyId],
    queryFn: async (): Promise<Record<TemplateKind, string>> => {
      const { data, error } = await supabase.from('message_template').select('kind, body').eq('company_id', companyId)
      if (error) throw error
      return { ...DEFAULT_TEMPLATES, ...Object.fromEntries((data ?? []).map((t) => [t.kind, t.body])) }
    },
  })

/** Recent visits to preview the templates with real data. */
export const sampleVisitsQuery = (companyId: string, personId: string) =>
  queryOptions({
    queryKey: ['admin', 'sample-visits', companyId],
    queryFn: async (): Promise<TeamVisit[]> => {
      const { data, error } = await supabase
        .from('visit')
        .select(TEAM_VISIT_SELECT)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('work_date', { ascending: false })
        .order('sort_order')
        .limit(40)
      if (error) throw error
      return (data as unknown as Parameters<typeof toTeamVisit>[0][]).map((r) => toTeamVisit(r, personId))
    },
  })

/** Work totals of a day's visits, for the daily report preview. */
export const sampleMetricsQuery = (visitIds: string[]) =>
  queryOptions({
    queryKey: ['admin', 'sample-metrics', visitIds.join(',')],
    enabled: visitIds.length > 0,
    queryFn: async (): Promise<Record<number, number>> => {
      const { data, error } = await supabase.from('visit_metric').select('metric_id, quantity').in('visit_id', visitIds)
      if (error) throw error
      const totals: Record<number, number> = {}
      for (const m of data ?? []) totals[m.metric_id] = (totals[m.metric_id] ?? 0) + m.quantity
      return totals
    },
  })

export function useSaveTemplate(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ kind, body }: { kind: TemplateKind; body: string }) => {
      const { error } = await supabase.from('message_template').upsert({ company_id: companyId, kind, body }, { onConflict: 'company_id,kind' })
      if (error) throw new Error('No pudimos guardar la plantilla. Probá de nuevo.')
    },
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: ['admin', 'templates', companyId] }), qc.invalidateQueries({ queryKey: ['catalogs', companyId] })]),
  })
}
