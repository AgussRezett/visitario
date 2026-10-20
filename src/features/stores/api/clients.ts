import { queryOptions } from '@tanstack/react-query'
import { supabase, type Enums } from '@/lib/supabase'

/** A seller's client with its last activation. */
export interface Client {
  id: string
  name: string | null
  address: string
  area: string | null
  customerNumber: string | null
  channelId: number | null
  lastVisit: { date: string; status: Enums<'work_status'>; review: Enums<'review_status'>; by: string } | null
  visits30d: number
}

/** My stores as a seller (only mine; the database checks it). */
export const clientsQuery = (companyId: string) =>
  queryOptions({
    queryKey: ['stores', 'clients', companyId],
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await supabase.rpc('seller_stores', { p_company: companyId })
      if (error) throw error
      return (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        address: r.address,
        area: r.area,
        customerNumber: r.customer_number,
        channelId: r.channel_id,
        lastVisit: r.last_visit_date && r.last_visit_status && r.last_visit_review
          ? { date: r.last_visit_date, status: r.last_visit_status, review: r.last_visit_review, by: r.last_merchandiser ?? '' }
          : null,
        visits30d: r.visits_30d,
      }))
    },
  })
