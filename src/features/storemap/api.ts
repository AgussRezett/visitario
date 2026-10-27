import { queryOptions } from '@tanstack/react-query'
import { supabase, type Enums } from '@/lib/supabase'
import type { MapPoint } from '@/domain/store-map'

/** The points of sale I can see: all of the company (supervisor, admin) or my clients (seller). */
export const storeMapQuery = (companyId: string) =>
  queryOptions({
    queryKey: ['stores', 'map', companyId],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MapPoint[]> => {
      const { data, error } = await supabase.rpc('store_map', { p_company: companyId })
      if (error) throw error
      return (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        address: r.address,
        area: r.area,
        customerNumber: r.customer_number,
        lat: r.lat,
        lng: r.lng,
        channelId: r.channel_id,
        sellerId: r.seller_id,
        lastVisitDate: r.last_visit_date,
        lastMerchandiser: r.last_merchandiser,
        visits30: r.visits_30d,
        visits90: r.visits_90d,
        rapport: r.rapport === null ? null : Number(r.rapport),
      }))
    },
  })

export interface ClientVisit {
  id: string
  date: string
  status: Enums<'work_status'>
  review: Enums<'review_status'>
  consent: Enums<'consent_kind'> | null
  merchandiser: string
  displays: string[]
  metrics: { name: string; quantity: number }[]
}

export interface ClientHistory {
  store: { id: string; name: string | null; address: string; area: string | null; customerNumber: string | null; lat: number | null; lng: number | null; channelId: number | null; sellerId: number | null }
  visits: ClientVisit[]
}

interface HistoryRow {
  store: { id: string; name: string | null; address: string; area: string | null; customer_number: string | null; lat: number | null; lng: number | null; channel_id: number | null; seller_id: number | null }
  visits: ClientVisit[]
}

/** A client's profile and its last activations; null when it is not mine to see. */
export const clientHistoryQuery = (companyId: string, storeId: string) =>
  queryOptions({
    queryKey: ['stores', 'client', companyId, storeId],
    queryFn: async (): Promise<ClientHistory | null> => {
      const { data, error } = await supabase.rpc('client_history', { p_company: companyId, p_store: storeId })
      if (error) throw error
      const h = data as unknown as HistoryRow | null
      if (!h) return null
      const s = h.store
      return {
        store: { id: s.id, name: s.name, address: s.address, area: s.area, customerNumber: s.customer_number, lat: s.lat, lng: s.lng, channelId: s.channel_id, sellerId: s.seller_id },
        visits: h.visits ?? [],
      }
    },
  })
