import { shortestPath } from './tsp'

// The day's route: the best order to visit the stores that are left, by straight-line
// distance (the MVP's algorithm). Street distances come from LocationIQ when available
// (supabase/functions/route); this order is the fallback and works without signal.

export interface Point {
  lat: number
  lng: number
}

export interface Stop {
  id: string
  location: Point
}

export type TravelMode = 'driving' | 'walking'

/** Great-circle distance in km. */
export function distanceKm(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const arc = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 12742 * Math.asin(Math.min(1, Math.sqrt(arc)))
}

export interface RouteRequest {
  stops: readonly Stop[]
  /** Where the merchandiser is; without it the route starts at a store. */
  origin?: Point
  firstId?: string
  lastId?: string
}

/** Length of the trip in km, from the origin (if any) through the stops in this order. */
export function routeKm(order: readonly Stop[], origin?: Point): number {
  let km = 0
  let prev = origin
  for (const s of order) {
    if (prev) km += distanceKm(prev, s.location)
    prev = s.location
  }
  return km
}

/**
 * The shortest order that respects the first and last store, by straight-line distance:
 * exact up to 15 stores, local search above (see domain/tsp). Used without signal or
 * without the street router; the router uses the same solver with street distances.
 */
export function approximateRoute({ stops, origin, firstId, lastId }: RouteRequest): { ids: string[]; km: number } {
  if (!stops.length) return { ids: [], km: 0 }
  const plan = planNodes(stops, origin, firstId, lastId)
  const at = plan.points
  const { order } = shortestPath({
    n: at.length,
    start: plan.start,
    end: plan.end,
    cost: (i, j) => (plan.virtualStart && i === plan.start ? 0 : distanceKm(at[i] as Point, at[j] as Point)),
  })
  const ids = order.flatMap((i) => (i < plan.offset ? [] : [(stops[i - plan.offset] as Stop).id]))
  const byId = new Map(stops.map((s) => [s.id, s]))
  return { ids, km: routeKm(ids.map((id) => byId.get(id) as Stop), origin) }
}

/**
 * The points the solver sees: the origin first when the trip starts there (or a free start,
 * a point at zero cost from everything), then the stores. Where it starts and must end.
 */
export function planNodes(stops: readonly Stop[], origin: Point | undefined, firstId?: string, lastId?: string) {
  const first = stops.findIndex((s) => s.id === firstId)
  const lastIndex = stops.findIndex((s) => s.id === lastId && s.id !== firstId)
  const lead = first === -1 // the trip starts before the stores: at the origin, or anywhere
  const offset = lead ? 1 : 0
  const points: Point[] = [...(lead ? [origin ?? (stops[0] as Stop).location] : []), ...stops.map((s) => s.location)]
  return {
    points,
    offset,
    start: lead ? 0 : first,
    end: lastIndex === -1 ? undefined : lastIndex + offset,
    /** No origin and no first store: the start costs nothing to leave. */
    virtualStart: lead && !origin,
  }
}

/**
 * New sort orders for applying a route: the routed visits take the places they already had
 * in the day, in the new order; every other visit stays where it is.
 * Returns only the visits that move.
 */
export function applyRouteOrder(day: readonly { id: string; sortOrder: number }[], routeIds: readonly string[]): { id: string; sortOrder: number }[] {
  const inRoute = new Set(routeIds)
  const slots = day.filter((v) => inRoute.has(v.id)).map((v) => v.sortOrder).sort((a, b) => a - b)
  const current = new Map(day.map((v) => [v.id, v.sortOrder]))
  return routeIds.flatMap((id, i) => {
    const slot = slots[i]
    return slot !== undefined && current.get(id) !== slot ? [{ id, sortOrder: slot }] : []
  })
}

export interface MapsLeg {
  href: string
  /** Positions in the route, 1-based: "Tramo 1 · 1 a 4". */
  from: number
  to: number
}

/**
 * Stores per Google Maps link: 9 stops in between plus the destination, the most Maps takes
 * (the app on the phone and the web on a computer; only a phone browser without the app
 * takes fewer). 14 stores are 2 legs.
 */
export const MAPS_STOPS = 10

/** Google Maps links for the route, in legs. Each leg starts where the previous one ended. */
export function mapsLegs(places: readonly string[], mode: TravelMode, origin: Point | undefined, perLeg: number): MapsLeg[] {
  const legs: MapsLeg[] = []
  const step = Math.max(1, perLeg)
  let i = 0
  while (i < places.length) {
    const startAt = legs.length ? i - 1 : -1 // the previous leg's last stop
    const group = places.slice(i, i + step)
    const params = new URLSearchParams({ api: '1', travelmode: mode, destination: group[group.length - 1] as string })
    if (startAt >= 0) params.set('origin', places[startAt] as string)
    else if (origin) params.set('origin', `${origin.lat},${origin.lng}`)
    if (group.length > 1) params.set('waypoints', group.slice(0, -1).join('|'))
    legs.push({ href: `https://www.google.com/maps/dir/?${params}`, from: startAt >= 0 ? startAt + 1 : i + 1, to: i + group.length })
    i += group.length
  }
  return legs
}

/** Directions to one store. */
export function directionsUrl(place: string, mode: TravelMode): string {
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', travelmode: mode, destination: place })}`
}

/** How Maps should look a store up (see domain/places). */
export { mapsQuery as placeQuery } from './places'

/** What enters the route: what is still to do. Approved, finished or refused visits stay out. */
export function inRoute(v: { workStatus: 'pending' | 'in_progress' | 'done' | 'refused' | 'closed'; reviewStatus: string }): boolean {
  return v.reviewStatus !== 'approved' && (v.workStatus === 'pending' || v.workStatus === 'in_progress' || v.workStatus === 'closed')
}

/**
 * The path from the point nearest the first store on. A route calculated from the phone's
 * position is saved without that stretch: where the person was is never stored.
 */
export function lineFromFirstStop(line: readonly [number, number][], first: Point): [number, number][] {
  if (!line.length) return []
  let best = 0
  let bestKm = Infinity
  line.forEach(([lng, lat], i) => {
    const km = distanceKm({ lat, lng }, first)
    if (km < bestKm) {
      best = i
      bestKm = km
    }
  })
  return line.slice(best)
}
