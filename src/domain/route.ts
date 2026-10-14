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
 * The shortest order that respects the first and last store. Exact up to 11 stores
 * (dynamic programming), nearest neighbour plus 2-opt above that: 14 stores take a few ms.
 */
export function approximateRoute({ stops, origin, firstId, lastId }: RouteRequest): { ids: string[]; km: number } {
  const n = stops.length
  if (!n) return { ids: [], km: 0 }
  const at = (i: number) => (stops[i] as Stop).location
  const start = stops.findIndex((s) => s.id === firstId)
  const end = n > 1 ? stops.findIndex((s) => s.id === lastId && s.id !== firstId) : -1
  const dist = (a: number, b: number) => distanceKm(at(a), at(b))
  const initial = (i: number) => (origin ? distanceKm(origin, at(i)) : 0)
  const cost = (order: readonly number[]) =>
    order.reduce((sum, i, pos) => sum + (pos === 0 ? initial(i) : dist(order[pos - 1] as number, i)), 0)

  let best: number[]
  if (n <= 11) {
    const full = (1 << n) - 1
    const memo = new Map<number, { cost: number; order: number[] }>()
    const solve = (mask: number, prev: number): { cost: number; order: number[] } => {
      if (mask === full) return { cost: 0, order: [] }
      const key = mask * 16 + (prev + 1)
      const seen = memo.get(key)
      if (seen) return seen
      let result = { cost: Infinity, order: [] as number[] }
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) continue
        if (mask === 0 && start !== -1 && i !== start) continue
        const lastFree = mask === (full ^ (1 << i))
        if (i === end && !lastFree) continue
        if (lastFree && end !== -1 && i !== end) continue
        const tail = solve(mask | (1 << i), i)
        const total = (prev === -1 ? initial(i) : dist(prev, i)) + tail.cost
        if (total < result.cost) result = { cost: total, order: [i, ...tail.order] }
      }
      memo.set(key, result)
      return result
    }
    best = solve(0, -1).order
  } else {
    best = []
    const remaining = new Set(stops.map((_, i) => i))
    if (start !== -1) {
      best.push(start)
      remaining.delete(start)
    }
    if (end !== -1) remaining.delete(end)
    while (remaining.size) {
      let next = -1
      let nearest = Infinity
      for (const i of remaining) {
        const last = best[best.length - 1]
        const d = last === undefined ? initial(i) : dist(last, i)
        if (d < nearest) {
          nearest = d
          next = i
        }
      }
      best.push(next)
      remaining.delete(next)
    }
    if (end !== -1) best.push(end)
    // Reverse inner stretches while that shortens the trip.
    let improved = true
    while (improved) {
      improved = false
      for (let i = start === -1 ? 0 : 1; i < best.length - 1; i++) {
        for (let j = i + 1; j < best.length - (end === -1 ? 0 : 1); j++) {
          const candidate = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)]
          if (cost(candidate) + 1e-9 < cost(best)) {
            best = candidate
            improved = true
          }
        }
      }
    }
  }
  return { ids: best.map((i) => (stops[i] as Stop).id), km: cost(best) }
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
 * Google Maps links for the route, in legs: Maps on a phone takes 3 stops in between,
 * on a computer up to 9. Each leg starts where the previous one ended.
 */
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

/** How Maps should look a store up: the address and its neighbourhood. */
export function placeQuery(store: { address: string; area: string | null }): string {
  return store.area ? `${store.address}, ${store.area}` : store.address
}

/** What enters the route: what is still to do. Approved, finished or refused visits stay out. */
export function inRoute(v: { workStatus: 'pending' | 'in_progress' | 'done' | 'refused' | 'closed'; reviewStatus: string }): boolean {
  return v.reviewStatus !== 'approved' && (v.workStatus === 'pending' || v.workStatus === 'in_progress' || v.workStatus === 'closed')
}
