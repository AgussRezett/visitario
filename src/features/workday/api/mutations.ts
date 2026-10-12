import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, type Enums } from '@/lib/supabase'
import { workdayKeys } from './queries'

export class WorkdayError extends Error {}

/** Spanish message for database errors the person can act on. */
export function workdayErrorMessage(error: { message?: string; code?: string } | null | undefined) {
  const m = error?.message ?? ''
  if (m.includes('preparing')) return 'Tu supervisor está armando la jornada de ese día. Esperá a que la publique.'
  if (m.includes('storefront')) return 'Sacá la foto de la fachada antes de terminar la visita.'
  if (m.includes('consent')) return 'Marcá si el local te autorizó antes de terminar.'
  if (m.includes('approved visit is locked')) return 'Esta visita ya fue aprobada y no se puede cambiar.'
  if (m.includes('store_customer_number') || (error?.code === '23505' && m.includes('customer'))) return 'Ese número de cliente ya está en el directorio. Buscalo arriba.'
  if (m.includes('removes an assigned visit')) return 'Esta parada la asignó tu supervisor: solo él puede quitarla.'
  if (m.includes('transition')) return 'Ese cambio de estado no está permitido.'
  return 'No pudimos guardar el cambio. Probá de nuevo.'
}

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

type VisitPatch = Partial<{
  work_status: Enums<'work_status'>
  arrived_at: string | null
  consent: Enums<'consent_kind'> | null
  objection: string | null
  retry_after: string | null
  notes: string | null
  task: string | null
  deleted_at: string | null
}>

export function useUpdateVisit(visitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: VisitPatch) => {
      const { error } = await supabase.from('visit').update(patch).eq('id', visitId)
      if (error) throw new WorkdayError(workdayErrorMessage(error))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: workdayKeys.all }),
  })
}

/** Takes the stop off the day (soft delete; the history keeps it). */
export function useRemoveVisit(visitId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('visit').update({ deleted_at: new Date().toISOString() }).eq('id', visitId)
      if (error) throw new WorkdayError(workdayErrorMessage(error))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: workdayKeys.all }),
  })
}

export function useSetMetric(visitId: string, companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ metricId, quantity }: { metricId: number; quantity: number }) => {
      const { error } = await supabase
        .from('visit_metric')
        .upsert({ company_id: companyId, visit_id: visitId, metric_id: metricId, quantity }, { onConflict: 'visit_id,metric_id' })
      if (error) throw new WorkdayError(workdayErrorMessage(error))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['workday', 'visit-work', visitId] }),
  })
}

export function useToggleBrand(visitId: string, companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ brandId, on }: { brandId: number; on: boolean }) => {
      const { error } = on
        ? await supabase.from('visit_brand').upsert({ company_id: companyId, visit_id: visitId, brand_id: brandId }, { onConflict: 'visit_id,brand_id', ignoreDuplicates: true })
        : await supabase.from('visit_brand').delete().eq('visit_id', visitId).eq('brand_id', brandId)
      if (error) throw new WorkdayError(workdayErrorMessage(error))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['workday', 'visit-work', visitId] }),
  })
}

export function useDisplayMutations(visitId: string, companyId: string) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: workdayKeys.all })
  const check = (error: { message: string } | null) => {
    if (error) throw new WorkdayError(workdayErrorMessage(error))
  }
  return {
    add: useMutation({
      mutationFn: async ({ typeId, sortOrder }: { typeId: number; sortOrder: number }) => {
        const { data, error } = await supabase
          .from('display')
          .insert({ company_id: companyId, visit_id: visitId, display_type_id: typeId, source: 'found', sort_order: sortOrder })
          .select('id')
          .single()
        check(error)
        return data?.id ?? ''
      },
      onSettled: refresh,
    }),
    update: useMutation({
      mutationFn: async ({ id, typeId, reference }: { id: string; typeId?: number; reference?: string | null }) => {
        const { error } = await supabase.from('display').update({ display_type_id: typeId, reference }).eq('id', id)
        check(error)
      },
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('display').update({ deleted_at: new Date().toISOString() }).eq('id', id)
        check(error)
      },
      onSettled: refresh,
    }),
  }
}
