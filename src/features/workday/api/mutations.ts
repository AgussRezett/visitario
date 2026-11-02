import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, type Enums } from '@/lib/supabase'
import { workdayErrorMessage } from './errors'
import { workdayKeys } from './queries'

export { workdayErrorMessage }

export class WorkdayError extends Error {}

async function rpc<T>(promise: PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>) {
  const { data, error } = await promise
  if (error) throw new WorkdayError(workdayErrorMessage(error))
  return data as T
}

export function useOpenWorkday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ companyId, date }: { companyId: string; date: string }) =>
      rpc<string>(supabase.rpc('open_workday', { p_company: companyId, p_date: date })),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: workdayKeys.all }), qc.invalidateQueries({ queryKey: ['team'] })]),
  })
}

async function storeOfVisit(visitId: string) {
  const { data, error } = await supabase.from('visit').select('store_id').eq('id', visitId).single()
  if (error) throw new WorkdayError(workdayErrorMessage(error))
  return data.store_id
}

/** Sets a store's channel and seller (null leaves one as it is). */
export async function tagStore(storeId: string, channelId: number | null, sellerId: number | null) {
  await rpc(supabase.rpc('tag_store', { p_store: storeId, p_channel: channelId ?? undefined, p_seller: sellerId ?? undefined }))
}

export interface NewAddress {
  storeId?: string
  address?: string
  name?: string
  customerNumber?: string
  area?: string | null
  lat?: number | null
  lng?: number | null
  locationStatus?: Enums<'location_status'>
  task?: string
  displayTypes?: number[]
  /** The store's channel and seller (a merchandiser only fills them while empty). */
  channelId?: number | null
  sellerId?: number | null
}

export function useAddVisit(workdayId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (a: NewAddress) => {
      const visitId = await rpc<string>(
        supabase.rpc('add_visit', {
          p_workday: workdayId,
          p_store: a.storeId,
          p_address: a.address,
          p_name: a.name,
          p_customer_number: a.customerNumber,
          p_area: a.area ?? undefined,
          p_lat: a.lat ?? undefined,
          p_lng: a.lng ?? undefined,
          p_location_status: a.locationStatus,
          p_task: a.task,
          p_display_types: a.displayTypes ?? [],
        }),
      )
      if (a.channelId || a.sellerId) await tagStore(a.storeId ?? (await storeOfVisit(visitId)), a.channelId ?? null, a.sellerId ?? null)
      return visitId
    },
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: workdayKeys.all }), qc.invalidateQueries({ queryKey: ['team'] })]),
  })
}

export interface PastedRow {
  customerNumber?: string
  address?: string
  area?: string | null
  channelId?: number | null
  sellerId?: number | null
}

/** Several pasted stores in one call: each line on its own, with the reason when one fails. */
export function useAddVisits(workdayId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rows: PastedRow[]) =>
      rpc<{ idx: number; created: boolean; error: string | null; detail: string | null; matched_by: string | null }[]>(
        supabase.rpc('add_visits', {
          p_workday: workdayId,
          p_rows: rows.map((r) => ({
            customer_number: r.customerNumber || null,
            address: r.address || null,
            area: r.area || null,
            channel: r.channelId ?? null,
            seller: r.sellerId ?? null,
          })),
        }),
      ),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: workdayKeys.all }), qc.invalidateQueries({ queryKey: ['team'] })]),
  })
}

/**
 * Not resuming some pending visits: they are not offered again and stay in their day
 * as not visited (the supervisor still sees them there).
 */
export function useDismissResumable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (visitIds: string[]) => {
      const { error } = await supabase.rpc('dismiss_resumable', { p_visits: visitIds })
      if (error) throw new Error(workdayErrorMessage(error))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['workday', 'resumable'] }),
  })
}
