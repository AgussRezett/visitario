import { supabase } from '@/lib/supabase'
import type { Point, Stop, TravelMode } from '@/domain/route'

export interface StreetRoute {
  ids: string[]
  km: number
  minutes: number
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
  return data.ids.length === known.size && data.ids.every((id) => known.has(id)) ? data : null
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
