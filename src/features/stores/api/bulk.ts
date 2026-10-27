import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chunks, type BulkChange } from '@/domain/bulk-edit'
import { fetchDirectory, storeError, type DirectoryRow, type DirectorySearch } from './stores'

// The directory answers at most 200 stores per request.
const MATCH_PAGE = 200
// Each request carries its ids in the URL.
const IDS_PER_UPDATE = 100

/** Every store that matches the filters, page after page: for "select all that match". */
export async function fetchAllMatching(companyId: string, q: DirectorySearch): Promise<DirectoryRow[]> {
  const first = await fetchDirectory(companyId, q, MATCH_PAGE, 0)
  const rest = await Promise.all(
    Array.from({ length: Math.ceil(first.total / MATCH_PAGE) - 1 }, (_, i) => fetchDirectory(companyId, q, MATCH_PAGE, (i + 1) * MATCH_PAGE)),
  )
  return [first, ...rest].flatMap((p) => p.rows)
}

export class BulkError extends Error {
  constructor(message: string, readonly saved: number) {
    super(message)
  }
}

/** The same seller, channel or zone for many stores. Answers how many changed. */
export function useBulkUpdateStores(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids, change }: { ids: string[]; change: BulkChange }) => {
      const patch = {
        ...('sellerId' in change ? { seller_id: change.sellerId ?? null } : {}),
        ...('channelId' in change ? { channel_id: change.channelId ?? null } : {}),
        ...('area' in change ? { area: change.area?.trim() || null } : {}),
      }
      let saved = 0
      for (const part of chunks(ids, IDS_PER_UPDATE)) {
        const { data, error } = await supabase.from('store').update(patch).eq('company_id', companyId).in('id', part).is('removed_at', null).select('id')
        if (error) throw new BulkError(storeError(error.message), saved)
        saved += data.length
      }
      return saved
    },
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: ['stores'] }), qc.invalidateQueries({ queryKey: ['workday'] }), qc.invalidateQueries({ queryKey: ['team'] })]),
  })
}
