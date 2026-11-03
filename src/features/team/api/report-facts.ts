import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { EMPTY_FACTS, type Facts } from '@/domain/analytics'
import type { Range } from '@/domain/report-period'

/** The raw facts of a period (see public.report_facts): what the reports panel counts. */
export const reportFactsQuery = (companyId: string, range: Range) =>
  queryOptions({
    queryKey: ['team', 'report-facts', companyId, range.from, range.to] as const,
    staleTime: 60_000,
    queryFn: async (): Promise<Facts> => {
      const { data, error } = await supabase.rpc('report_facts', { p_company: companyId, p_from: range.from, p_to: range.to })
      if (error) throw error
      return { ...EMPTY_FACTS, ...(data as unknown as Partial<Facts>) }
    },
  })
