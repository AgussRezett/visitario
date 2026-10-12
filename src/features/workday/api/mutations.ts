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
    onSuccess: () => qc.invalidateQueries({ queryKey: workdayKeys.all }),
  })
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
}

export function useAddVisit(workdayId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (a: NewAddress) =>
      rpc<string>(
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
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: workdayKeys.all }),
  })
}
