import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { overlapsByRow, type Overlap } from '@/domain/overlaps'

/** A store about to go into a day: by directory id, or by the address and customer number typed. */
export interface OverlapAsk {
  storeId?: string
  address?: string
  customerNumber?: string
}

/**
 * Who else has these stores in a day of that same date (public.day_overlaps), grouped by
 * the row asked. Answers only with a connection; without one, nothing is said.
 */
export function useDayOverlaps(workdayId: string, asks: OverlapAsk[], enabled: boolean) {
  const rows = asks.map((a) => ({ store_id: a.storeId, address: a.address?.trim() || undefined, customer_number: a.customerNumber?.trim() || undefined }))
  return useQuery({
    queryKey: ['workday', 'overlaps', workdayId, rows] as const,
    enabled: enabled && Boolean(workdayId) && rows.some((r) => r.store_id || r.customer_number || (r.address?.length ?? 0) >= 3),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<number, Overlap[]>> => {
      const { data, error } = await supabase.rpc('day_overlaps', { p_workday: workdayId, p_rows: rows })
      if (error) throw error
      return overlapsByRow(
        (data ?? []).map((r) => ({
          idx: r.idx,
          sameWorkday: r.same_workday,
          merchandiserFirst: r.merchandiser_first,
          merchandiserLast: r.merchandiser_last,
          addedByFirst: r.added_by_first,
          addedByMerchandiser: r.added_by_merchandiser,
          workStatus: r.work_status,
        })),
      )
    },
  })
}
