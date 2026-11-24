import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { KnownStore } from '@/domain/add-review'

/**
 * Which rows about to be added are already stores of the directory (public.match_day_stores:
 * the same customer number, or the same address written another way), by row key.
 */
export function useKnownStores(companyId: string, rows: { key: string; customerNumber: string; address: string }[], enabled: boolean) {
  const asks = rows.map((r) => ({ customer_number: r.customerNumber.trim() || undefined, address: r.address.trim() || undefined }))
  const keys = rows.map((r) => r.key)
  return useQuery({
    queryKey: ['stores', 'known', companyId, asks, keys] as const,
    enabled: enabled && rows.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<string, KnownStore>> => {
      const { data, error } = await supabase.rpc('match_day_stores', { p_company: companyId, p_rows: asks })
      if (error) throw error
      return new Map((data ?? []).flatMap((m) => {
        const key = keys[m.idx]
        return key ? [[key, {
          id: m.store_id, name: m.name, address: m.address, area: m.area, customerNumber: m.customer_number,
          channelId: m.channel_id, sellerId: m.seller_id, by: m.matched_by === 'customer' ? 'customer' : 'address',
        } satisfies KnownStore] as const] : []
      }))
    },
  })
}
