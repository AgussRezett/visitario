import { queryOptions, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toStoreReputation, type RapportFact, type StoreReputation } from '@/domain/reputation'

/**
 * The reputation of some stores, for anyone in the company (merchandisers included):
 * only numbers, never who rated what. Changes slowly, so it is kept for a while.
 */
export const storeReputationQuery = (companyId: string, storeIds: readonly string[]) => {
  const ids = [...new Set(storeIds)].sort()
  return queryOptions({
    queryKey: ['reputation', 'stores', companyId, ids] as const,
    staleTime: 10 * 60_000,
    enabled: Boolean(companyId) && ids.length > 0,
    queryFn: async (): Promise<Map<string, StoreReputation>> => {
      const { data, error } = await supabase.rpc('store_reputation', { p_company: companyId, p_stores: ids })
      if (error) throw error
      return new Map((data ?? []).flatMap((r) => {
        const rep = toStoreReputation(r)
        return rep ? [[rep.storeId, rep] as const] : []
      }))
    },
  })
}

export function useStoreReputation(companyId: string, storeIds: readonly string[]) {
  return useQuery(storeReputationQuery(companyId, storeIds))
}

/** The dashboard's ratings for a period, under the caller's RLS (a supervisor: their team). */
export const rapportFactsQuery = (companyId: string, from: string, to: string) =>
  queryOptions({
    queryKey: ['reputation', 'facts', companyId, from, to] as const,
    enabled: Boolean(companyId),
    queryFn: async (): Promise<RapportFact[]> => {
      const { data, error } = await supabase.rpc('rapport_facts', { p_company: companyId, p_from: from, p_to: to })
      if (error) throw error
      return (data ?? []).map((r) => ({
        week: r.week,
        storeId: r.store_id,
        storeName: r.store_name ?? r.address,
        area: r.area,
        merchandiserId: r.merchandiser_id,
        merchandiserName: `${r.first_name} ${r.last_name}`.trim(),
        rapport: r.rapport,
        visits: r.visits,
      }))
    },
  })
