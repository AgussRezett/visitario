/**
 * Armar recorrido: a goal and filters choose the stores that serve it best and are close
 * together. Pure rules; the order by streets comes from the route function afterwards.
 */
import { daysBetween } from './dates'
import { matchesAny } from './filters'
import { levelOf, RAPPORT_SHORT } from './reputation'
import { distanceKm } from './route'
import type { MapPoint } from './store-map'

export type PlanGoal = 'most' | 'overdue' | 'requests' | 'rapport'

export const GOALS: { value: PlanGoal; label: string; help: string }[] = [
  { value: 'most', label: 'Más activaciones', help: 'La mayor cantidad de locales en el menor trayecto.' },
  { value: 'overdue', label: 'Los más atrasados', help: 'Primero los nunca activados y los que llevan más días sin visita.' },
  { value: 'requests', label: 'Pedidos y novedades', help: 'Primero los pedidos de los vendedores y los locales con novedades abiertas.' },
  { value: 'rapport', label: 'Mejor trato', help: 'Primero los locales que reciben mejor al activador.' },
]

/** A store of the map with what it has pending on the day being planned. */
export interface Candidate extends MapPoint {
  openRequest: boolean
  requestBy: string | null
  openIssues: number
  /** Whose day it is already in on that date ("Lucía, Pedro"). */
  plannedFor: string | null
}

export interface PlanFilters {
  /** A zone drawn on the map, as [lng, lat] points. */
  zone: [number, number][] | null
  areas: string[]
  sellerIds: number[]
  channelIds: number[]
  /** Only stores rated at least this well (0 to 3); unrated ones stay out. */
  minRapport: number | null
  /** Only stores not activated in more than this many days (never activated count). */
  staleDays: number | null
  /** Also stores already in someone's day that date. */
  includePlanned: boolean
}

export const NO_PLAN_FILTERS: PlanFilters = { zone: null, areas: [], sellerIds: [], channelIds: [], minRapport: null, staleDays: null, includePlanned: false }

/** The route function solves up to 25 stops by streets. */
export const STOP_COUNTS = [6, 8, 10, 12, 15, 20, 25] as const

type Located = Candidate & { lat: number; lng: number }

/** Whether a point is inside a polygon (ray casting; the ring needs no closing point). */
export function inZone(lng: number, lat: number, ring: readonly [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number]
    const [xj, yj] = ring[j] as [number, number]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const daysSince = (c: Pick<MapPoint, 'lastVisitDate'>, today: string) => (c.lastVisitDate ? daysBetween(c.lastVisitDate, today) : null)

/** The stores the filters leave, with a location (a route needs one). */
export function eligible(cands: readonly Candidate[], f: PlanFilters, today: string): Located[] {
  return cands.filter((c): c is Located => {
    if (c.lat === null || c.lng === null) return false
    if (f.zone && f.zone.length >= 3 && !inZone(c.lng, c.lat, f.zone)) return false
    if (!f.includePlanned && c.plannedFor) return false
    if (f.minRapport !== null && (c.rapport === null || c.rapport < f.minRapport)) return false
    if (f.staleDays !== null) {
      const d = daysSince(c, today)
      if (d !== null && d <= f.staleDays) return false
    }
    return matchesAny(c.area, f.areas, '') && matchesAny(c.sellerId, f.sellerIds, 0) && matchesAny(c.channelId, f.channelIds, 0)
  })
}

/** How much a store serves the goal, 0 to 1. */
export function priority(c: Candidate, goal: PlanGoal, today: string): number {
  const d = daysSince(c, today)
  const overdue = d === null ? 1 : Math.min(d, 120) / 120
  if (goal === 'overdue') return overdue
  if (goal === 'requests') return (c.openRequest ? 0.6 : 0) + (Math.min(c.openIssues, 3) / 3) * 0.3 + overdue * 0.1
  if (goal === 'rapport') return c.rapport === null ? 0.3 : (c.rapport / 3) * 0.9 + overdue * 0.1
  return 1
}

/**
 * The stores to visit: worth the most for the goal and close together. From each of a few
 * starting stores, the route grows with the store that adds the most value for the least
 * distance; the best of those routes wins. Deterministic: same input, same route.
 */
export function chooseStops<T extends Located>(cands: readonly T[], goal: PlanGoal, count: number, today: string): T[] {
  const value = new Map(cands.map((c) => [c.id, 0.25 + priority(c, goal, today)]))
  const worth = (c: T) => value.get(c.id) ?? 0
  const byWorth = [...cands].sort((a, b) => worth(b) - worth(a) || a.id.localeCompare(b.id))
  if (cands.length <= count) return byWorth
  // For "most", where every store is worth the same, start where stores are densest.
  const near = (c: T) => cands.filter((o) => o !== c && distanceKm(c, o) <= 1).length
  const seeds = goal === 'most'
    ? [...cands].map((c) => ({ c, n: near(c) })).sort((a, b) => b.n - a.n || a.c.id.localeCompare(b.c.id)).slice(0, 8).map((x) => x.c)
    : byWorth.slice(0, 8)

  let best: { stops: T[]; score: number } | null = null
  for (const seed of seeds) {
    const stops = [seed]
    let km = 0
    const left = new Set(cands.filter((c) => c !== seed))
    while (stops.length < count && left.size) {
      let pick: T | null = null
      let pickGain = -1
      let pickKm = 0
      for (const c of left) {
        const d = Math.min(...stops.map((s) => distanceKm(s, c)))
        const gain = worth(c) / (0.3 + d)
        if (gain > pickGain || (gain === pickGain && pick !== null && c.id < pick.id)) {
          pick = c
          pickGain = gain
          pickKm = d
        }
      }
      if (!pick) break
      stops.push(pick)
      left.delete(pick)
      km += pickKm
    }
    // Value gathered, less a little for every km it takes to gather it.
    const score = stops.reduce((n, s) => n + worth(s), 0) - km * 0.15
    if (!best || score > best.score) best = { stops, score }
  }
  return best?.stops ?? []
}

/** Where to start: the stop farthest from the middle, so the route sweeps through once. */
export function startOf(stops: readonly { id: string; lat: number; lng: number }[]): string | undefined {
  if (!stops.length) return undefined
  const mid = { lat: stops.reduce((n, s) => n + s.lat, 0) / stops.length, lng: stops.reduce((n, s) => n + s.lng, 0) / stops.length }
  return [...stops].sort((a, b) => distanceKm(b, mid) - distanceKm(a, mid) || a.id.localeCompare(b.id))[0]?.id
}

/** Why a store is in the route, in a few words each. */
export function reasonsFor(c: Candidate, today: string): string[] {
  const d = daysSince(c, today)
  const out = [d === null ? 'Nunca activado' : d === 0 ? 'Activado hoy' : `${d > 30 ? 'Sin activar hace' : 'Activado hace'} ${d} ${d === 1 ? 'día' : 'días'}`]
  if (c.openRequest) out.push(c.requestBy ? `Pedido de ${c.requestBy}` : 'Pedido de activación')
  if (c.openIssues) out.push(c.openIssues === 1 ? '1 novedad abierta' : `${c.openIssues} novedades abiertas`)
  if (c.rapport !== null) out.push(`Trato: ${RAPPORT_SHORT[levelOf(c.rapport)].toLowerCase()}`)
  if (c.plannedFor) out.push(`Ya está en la jornada de ${c.plannedFor}`)
  return out
}
