import { approximateRoute, type Stop, type TravelMode } from '@/domain/route'
import { startOf, type Candidate } from '@/domain/route-plan'
import { streetRoute } from '@/features/route/api'

export interface PlannedRoute {
  stops: (Candidate & { lat: number; lng: number })[]
  km: number
  /** By streets, when the service answered. */
  minutes: number | null
  line: [number, number][] | null
}

/**
 * The stops in the order to visit them: by streets when the route service answers
 * (exact up to 15 stops), else in straight lines on the phone.
 */
export async function orderStops(chosen: (Candidate & { lat: number; lng: number })[], mode: TravelMode): Promise<PlannedRoute> {
  const stops: Stop[] = chosen.map((c) => ({ id: c.id, location: { lat: c.lat, lng: c.lng } }))
  const firstId = startOf(chosen)
  const byId = new Map(chosen.map((c) => [c.id, c]))
  const pick = (ids: string[]) => ids.flatMap((id) => (byId.has(id) ? [byId.get(id) as PlannedRoute['stops'][number]] : []))
  const street = await streetRoute({ stops, firstId, mode }).catch(() => null)
  if (street) return { stops: pick(street.ids), km: street.km, minutes: street.minutes, line: street.line.length > 1 ? street.line : null }
  const straight = approximateRoute({ stops, firstId })
  return { stops: pick(straight.ids), km: straight.km, minutes: null, line: null }
}
