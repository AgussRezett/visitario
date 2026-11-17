import { FunctionsHttpError } from '@supabase/supabase-js'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Candidate } from '@/domain/route-plan'
import type { MapPoint } from '@/domain/store-map'

/** No zone: the whole company. */
export const ALL_ZONES = 'all'

export interface RouteZone {
  id: string
  name: string
  ring: [number, number][]
}

const keys = {
  zones: (companyId: string) => ['route-zones', companyId] as const,
  pending: (companyId: string, date: string) => ['route-candidates', companyId, date] as const,
}

/** The zones drawn for the company, by name. */
export const zonesQuery = (companyId: string) =>
  queryOptions({
    queryKey: keys.zones(companyId),
    queryFn: async (): Promise<RouteZone[]> => {
      const { data, error } = await supabase.from('route_zone').select('id, name, ring').eq('company_id', companyId).is('deleted_at', null).order('name')
      if (error) throw error
      return (data ?? []).map((z) => ({ id: z.id, name: z.name, ring: z.ring as [number, number][] }))
    },
  })

export function useZones(companyId: string, personId: string) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: keys.zones(companyId) })
  const save = useMutation({
    mutationFn: async (z: { name: string; ring: [number, number][] }): Promise<string> => {
      const { data, error } = await supabase.from('route_zone').insert({ company_id: companyId, name: z.name.trim(), ring: z.ring, created_by: personId }).select('id').single()
      if (error) throw new Error(error.code === '23505' ? 'Ya hay una zona con ese nombre.' : 'No pudimos guardar la zona. Probá de nuevo.')
      return data.id
    },
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('route_zone').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw new Error('No pudimos borrar la zona. Probá de nuevo.')
    },
    onSuccess: refresh,
  })
  return { save, remove }
}

/** What each store has pending that day: requests, novedades, someone's day already. */
export const pendingQuery = (companyId: string, date: string) =>
  queryOptions({
    queryKey: keys.pending(companyId, date),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('route_candidates', { p_company: companyId, p_date: date })
      if (error) throw error
      return new Map((data ?? []).map((r) => [r.store_id, { openRequest: r.open_request, requestBy: r.request_by, openIssues: r.open_issues, plannedFor: r.planned_for }]))
    },
  })

/** The map's points with what they have pending. */
export function toCandidates(points: readonly MapPoint[], pending: Map<string, Pick<Candidate, 'openRequest' | 'requestBy' | 'openIssues' | 'plannedFor'>>): Candidate[] {
  return points.map((p) => ({ ...p, openRequest: false, requestBy: null, openIssues: 0, plannedFor: null, ...pending.get(p.id) }))
}

/** The route into the merchandiser's day (a draft until published from Asignar), in its order. */
export function useAddRoute(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (r: { merchandiserId: string; date: string; storeIds: string[] }): Promise<number> => {
      const day = await supabase.rpc('plan_workday', { p_company: companyId, p_merchandiser: r.merchandiserId, p_date: r.date })
      if (day.error || !day.data) throw new Error('No pudimos abrir esa jornada. Probá de nuevo.')
      const added = await supabase.rpc('add_stores_to_day', { p_workday: day.data, p_stores: r.storeIds })
      if (added.error) throw new Error('No pudimos agregar el recorrido. Probá de nuevo.')
      return added.data ?? 0
    },
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: ['team'] }), qc.invalidateQueries({ queryKey: ['route-candidates', companyId] })]),
  })
}

export class PlanRequestError extends Error {}

const REQUEST_ERRORS: Record<string, string> = {
  plan: 'La IA no está incluida en el plan de tu empresa.',
  forbidden: 'Pedir recorridos con IA es para supervisores y administradores.',
  limit: 'Tu empresa usó toda la IA del mes: se renueva el 1. Mientras tanto, elegí los filtros a mano.',
  limit_person: 'Ya usaste la IA todo lo permitido por hoy: mañana se renueva. Mientras tanto, elegí los filtros a mano.',
  limit_platform: 'Por hoy se terminó la IA de Visitario: mañana se renueva. Mientras tanto, elegí los filtros a mano.',
  not_configured: 'La IA todavía no está activada.',
}

/** A route asked for in words, as the AI read it (checked afterwards against the lists). */
export async function askPlan(companyId: string, text: string, today: string): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke<{ plan: unknown }>('plan-request', { body: { company: companyId, text, today } })
  if (error) {
    const res = error instanceof FunctionsHttpError ? (error.context as Response) : null
    const code = ((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? ''
    throw new PlanRequestError(REQUEST_ERRORS[code] ?? 'No pudimos entender el pedido. Probá de nuevo, o elegí los filtros a mano.')
  }
  return data?.plan ?? null
}
