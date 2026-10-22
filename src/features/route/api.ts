import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Point, Stop, TravelMode } from '@/domain/route'

export interface StreetRoute {
  ids: string[]
  km: number
  minutes: number
  /** The path by streets as [lng, lat], to draw on the map (empty if the service did not send it). */
  line: [number, number][]
}

/**
 * The order by streets from LocationIQ, or null when it can't be had (no signal, the
 * service is off, too many stops): the caller keeps the straight-line order.
 */
export async function streetRoute(req: { stops: readonly Stop[]; origin?: Point; firstId?: string; lastId?: string; mode: TravelMode }): Promise<StreetRoute | null> {
  if (req.stops.length < 2 || req.stops.length + (req.origin ? 1 : 0) > 25 || (!req.origin && !req.firstId)) return null
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null
  const { data, error } = await supabase.functions.invoke<StreetRoute>('route', {
    body: {
      stops: req.stops.map((s) => ({ id: s.id, lat: s.location.lat, lng: s.location.lng })),
      origin: req.origin,
      firstId: req.firstId,
      lastId: req.lastId,
      mode: req.mode,
    },
  })
  if (error || !data) return null
  const known = new Set(req.stops.map((s) => s.id))
  if (data.ids.length !== known.size || !data.ids.every((id) => known.has(id))) return null
  return { ...data, line: Array.isArray(data.line) ? data.line : [] }
}

/** The phone's position, once, when the person asks for it. Never stored. */
export function currentPosition(): Promise<Point> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('unsupported'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  })
}

/** The last route calculated for a day, as it was saved. */
export interface SavedRoute {
  ids: string[]
  km: number
  minutes: number | null
  byStreet: boolean
  /** From the first store on (never from where the phone was). */
  line: [number, number][] | null
  mode: TravelMode
  fromOrigin: boolean
  savedAt: string
}

const isLine = (l: unknown): l is [number, number][] =>
  Array.isArray(l) && l.every((p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number'))

/** Under 'workday': it refreshes with the day (and is kept on the phone for offline). */
export const savedRouteQuery = (workdayId: string) =>
  queryOptions({
    queryKey: ['workday', 'route', workdayId] as const,
    queryFn: async (): Promise<SavedRoute | null> => {
      const { data, error } = await supabase
        .from('route_plan')
        .select('stop_ids, km, minutes, by_street, line, mode, from_origin, updated_at')
        .eq('workday_id', workdayId)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        ids: data.stop_ids, km: Number(data.km), minutes: data.minutes, byStreet: data.by_street,
        line: isLine(data.line) ? data.line : null, mode: data.mode === 'driving' ? 'driving' : 'walking',
        fromOrigin: data.from_origin, savedAt: data.updated_at,
      }
    },
  })

/** Keeps the route just calculated as the day's: the next one replaces it. */
export function useSaveRoute(workdayId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (r: Omit<SavedRoute, 'savedAt'>) => {
      const { error } = await supabase.rpc('save_route_plan', {
        p_workday: workdayId, p_mode: r.mode, p_from_origin: r.fromOrigin, p_stop_ids: r.ids, p_km: Math.round(r.km * 100) / 100,
        p_by_street: r.byStreet, p_minutes: r.minutes ?? undefined, p_line: r.line ?? undefined,
      })
      if (error) throw error
    },
    onMutate: (r) => {
      const saved: SavedRoute = { ...r, savedAt: new Date().toISOString() }
      qc.setQueryData(savedRouteQuery(workdayId).queryKey, saved)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: savedRouteQuery(workdayId).queryKey }),
  })
}
