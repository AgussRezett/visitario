import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Enums } from '@/lib/supabase'
import { collapseResumed, type LocationStatus, type StoreSource } from '@/domain/stores'
import { geocode } from '@/features/workday/api/geocode'
import { STORE_SELECT, TEAM_VISIT_SELECT } from '@/features/workday/api/selects'
import { toTeamVisit, type TeamVisit } from '@/features/team/api/queries'

export type DirectoryFilter = 'all' | 'unverified' | 'added'
export const PAGE_SIZE = 50

export interface DirectoryRow {
  id: string
  name: string | null
  address: string
  area: string | null
  customerNumber: string | null
  locationStatus: LocationStatus
  source: StoreSource
  createdByName: string | null
  lastVisit: { date: string; status: Enums<'work_status'>; review: Enums<'review_status'>; by: string } | null
  visits30d: number
}

export const directoryQuery = (companyId: string, q: { query: string; filter: DirectoryFilter; area: string | null; page: number }) =>
  queryOptions({
    queryKey: ['stores', 'directory', companyId, q],
    queryFn: async (): Promise<{ rows: DirectoryRow[]; total: number }> => {
      const { data, error } = await supabase.rpc('store_directory', {
        p_company: companyId,
        p_query: q.query || undefined,
        p_filter: q.filter,
        p_area: q.area ?? undefined,
        p_limit: PAGE_SIZE,
        p_offset: q.page * PAGE_SIZE,
      })
      if (error) throw error
      const rows = (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        address: r.address,
        area: r.area,
        customerNumber: r.customer_number,
        locationStatus: r.location_status,
        source: r.source,
        createdByName: r.created_by_name,
        lastVisit: r.last_visit_date && r.last_visit_status && r.last_visit_review
          ? { date: r.last_visit_date, status: r.last_visit_status, review: r.last_visit_review, by: r.last_merchandiser ?? '' }
          : null,
        visits30d: r.visits_30d,
      }))
      return { rows, total: Number(data?.[0]?.total ?? 0) }
    },
  })

export const directoryCountsQuery = (companyId: string) =>
  queryOptions({
    queryKey: ['stores', 'counts', companyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('store_directory_counts', { p_company: companyId })
      if (error) throw error
      const r = data?.[0]
      return { total: r?.total ?? 0, unverified: r?.unverified ?? 0, added: r?.added ?? 0, areas: r?.areas ?? [] }
    },
  })

export interface StoreDetail {
  id: string
  companyId: string
  name: string | null
  address: string
  area: string | null
  customerNumber: string | null
  lat: number | null
  lng: number | null
  locationStatus: LocationStatus
  source: StoreSource
  createdAt: string
  createdByName: string | null
}

export const storeQuery = (storeId: string) =>
  queryOptions({
    queryKey: ['stores', 'store', storeId],
    queryFn: async (): Promise<StoreDetail | null> => {
      const { data, error } = await supabase
        .from('store')
        .select(STORE_SELECT)
        .eq('id', storeId)
        .is('deleted_at', null)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        id: data.id, companyId: data.company_id, name: data.name, address: data.address, area: data.area, customerNumber: data.customer_number,
        lat: data.lat, lng: data.lng, locationStatus: data.location_status, source: data.source, createdAt: data.created_at,
        createdByName: (data.creator as { first_name: string } | null)?.first_name ?? null,
      }
    },
  })

/** The store's visits that I can see (a supervisor: their team's), newest first. */
/** A visit in a store's history; `resumedOn` is the day it was carried over from. */
export type StoreHistoryVisit = TeamVisit & { resumedOn: string | null }

export const storeVisitsQuery = (storeId: string, personId: string) =>
  queryOptions({
    queryKey: ['stores', 'visits', storeId],
    queryFn: async (): Promise<StoreHistoryVisit[]> => {
      const { data, error } = await supabase.from('visit').select(TEAM_VISIT_SELECT).eq('store_id', storeId).is('deleted_at', null)
        .order('work_date', { ascending: false }).limit(60)
      if (error) throw error
      const visits = (data as unknown as Parameters<typeof toTeamVisit>[0][]).map((r) => toTeamVisit(r, personId))
      // Pending visits carried to a later day: the later one stands for both.
      const next = visits.length
        ? await supabase.from('visit').select('resumed_from').in('resumed_from', visits.map((v) => v.id)).is('deleted_at', null)
        : { data: [], error: null }
      if (next.error) throw next.error
      return collapseResumed(visits, new Set(next.data.flatMap((r) => (r.resumed_from ? [r.resumed_from] : []))))
    },
  })

function storeError(m: string) {
  if (m.includes('store_customer_number') || m.includes('duplicate key')) return 'Ese número de cliente ya es de otro comercio. Si es el mismo, fusionalos.'
  if (m.includes('Only supervisors')) return 'Solo supervisores y administradores pueden hacerlo.'
  return 'No pudimos guardar el cambio. Probá de nuevo.'
}

/** What checking the address again did. */
export type VerifyResult = 'verified' | 'approximate' | 'kept' | 'not_found'

export interface StoreChange {
  name?: string | null
  address?: string
  area?: string | null
  customerNumber?: string | null
  lat?: number | null
  lng?: number | null
  locationStatus?: LocationStatus
}

export function useStoreAdmin(storeId: string) {
  const qc = useQueryClient()
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['stores'] }), qc.invalidateQueries({ queryKey: ['workday'] }), qc.invalidateQueries({ queryKey: ['team'] })])
  const update = useMutation({
    mutationFn: async (c: StoreChange) => {
      const { error } = await supabase.from('store').update({
        name: c.name, address: c.address, area: c.area, customer_number: c.customerNumber, lat: c.lat, lng: c.lng, location_status: c.locationStatus,
      }).eq('id', storeId)
      if (error) throw new Error(storeError(error.message))
    },
    onSettled: refresh,
  })
  /**
   * Looks the address up again. Only the address: the zone can be the company's own name
   * for an area. A street without the number never replaces a location already verified.
   */
  const verify = useMutation({
    mutationFn: async ({ address, area, scope, current }: { address: string; area: string | null; scope: 'caba' | 'argentina'; current: LocationStatus }): Promise<VerifyResult> => {
      const [place] = await geocode(address, scope)
      if (!place) return 'not_found'
      if (!place.exact && current === 'verified') return 'kept'
      const { error } = await supabase.from('store').update({ lat: place.lat, lng: place.lng, location_status: place.exact ? 'verified' : 'approximate', area: area ?? place.area })
        .eq('id', storeId)
      if (error) throw new Error(storeError(error.message))
      return place.exact ? 'verified' : 'approximate'
    },
    onSettled: refresh,
  })
  const merge = useMutation({
    mutationFn: async (dropId: string) => {
      const { data, error } = await supabase.rpc('merge_stores', { p_keep: storeId, p_drop: dropId })
      if (error) throw new Error(storeError(error.message))
      return data
    },
    onSettled: refresh,
  })
  return { update, verify, merge }
}
