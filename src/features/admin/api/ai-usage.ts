import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AiUsage {
  /** Who used it this month, most first. */
  people: { name: string; month: number; today: number }[]
  /** Captures per day this month (only days with some). */
  days: { day: string; captures: number }[]
}

/** The company's AI this month, by person and by day (admins only). */
export const companyAiUsageQuery = (companyId: string) =>
  queryOptions({
    queryKey: ['admin', 'ai-usage', companyId],
    queryFn: async (): Promise<AiUsage> => {
      const { data, error } = await supabase.rpc('company_ai_usage', { p_company: companyId })
      if (error) throw error
      const u = (data ?? {}) as Partial<AiUsage>
      return { people: u.people ?? [], days: u.days ?? [] }
    },
  })
