import { daysBetween } from './dates'
import { levelOf, RAPPORT_SHORT, type Rapport } from './reputation'

/** A point of sale on the map, with what the map colors and counts. */
export interface MapPoint {
  id: string
  name: string | null
  address: string
  area: string | null
  customerNumber: string | null
  lat: number | null
  lng: number | null
  channelId: number | null
  sellerId: number | null
  lastVisitDate: string | null
  lastMerchandiser: string | null
  visits30: number
  visits90: number
  /** Average reputation (0 to 3), null when nobody rated it. */
  rapport: number | null
}

export type ColorBy = 'seller' | 'recency' | 'channel' | 'rapport'
export type Recency = 'recent' | 'month' | 'stale' | 'never'

/** Categorical hues in a fixed order (validated for color-blind separation). A 9th seller is "Otros". */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'] as const
export const NONE_COLOR = '#8a8a85'
/** Status colors: never reused for a series; always shown with a label. */
export const RECENCY_COLOR: Record<Recency, string> = { recent: '#0ca30c', month: '#fab219', stale: '#d03b3b', never: NONE_COLOR }
export const RECENCY_LABEL: Record<Recency, string> = { recent: 'Últimos 7 días', month: '8 a 30 días', stale: 'Más de 30 días', never: 'Nunca activado' }
const RAPPORT_COLOR: Record<Rapport, string> = { welcoming: '#0ca30c', restricted: '#fab219', indifferent: '#ec835a', unwilling: '#d03b3b' }

/** How long since the last activation, in the four bands the map paints. */
export function recencyOf(p: Pick<MapPoint, 'lastVisitDate'>, today: string): { band: Recency; days: number | null } {
  if (!p.lastVisitDate) return { band: 'never', days: null }
  const days = daysBetween(p.lastVisitDate, today)
  return { band: days <= 7 ? 'recent' : days <= 30 ? 'month' : 'stale', days }
}

export interface Named {
  id: number
  name: string
}

export interface LegendItem {
  key: string
  label: string
  color: string
}

/**
 * Each seller (or channel) keeps its color whatever the filters: the color follows the
 * entity's place in the company's list, never its rank on screen.
 */
export function colorsFor(items: readonly Named[]): Map<number, string> {
  return new Map(items.map((x, i) => [x.id, SERIES[i] ?? NONE_COLOR]))
}

/** The color of a point, and the legend of the mode. */
export function painter(by: ColorBy, today: string, sellers: readonly Named[], channels: readonly Named[]) {
  const sellerColor = colorsFor(sellers)
  const channelColor = colorsFor(channels)
  const color = (p: MapPoint): string => {
    if (by === 'seller') return p.sellerId === null ? NONE_COLOR : sellerColor.get(p.sellerId) ?? NONE_COLOR
    if (by === 'channel') return p.channelId === null ? NONE_COLOR : channelColor.get(p.channelId) ?? NONE_COLOR
    if (by === 'rapport') return p.rapport === null ? NONE_COLOR : RAPPORT_COLOR[levelOf(p.rapport)]
    return RECENCY_COLOR[recencyOf(p, today).band]
  }
  const named = (list: readonly Named[], colors: Map<number, string>, none: string): LegendItem[] => [
    ...list.map((x) => ({ key: String(x.id), label: SERIES[list.indexOf(x)] ? x.name : `${x.name} (otros)`, color: colors.get(x.id) ?? NONE_COLOR })),
    { key: 'none', label: none, color: NONE_COLOR },
  ]
  const legend: LegendItem[] =
    by === 'seller' ? named(sellers, sellerColor, 'Sin vendedor')
    : by === 'channel' ? named(channels, channelColor, 'Sin canal')
    : by === 'rapport' ? [...(Object.keys(RAPPORT_COLOR) as Rapport[]).map((r) => ({ key: r, label: RAPPORT_SHORT[r], color: RAPPORT_COLOR[r] })), { key: 'none', label: 'Sin calificar', color: NONE_COLOR }]
    : (Object.keys(RECENCY_COLOR) as Recency[]).map((r) => ({ key: r, label: RECENCY_LABEL[r], color: RECENCY_COLOR[r] }))
  return { color, legend }
}

export interface MapFilters {
  area: string | null
  /** A seller's id, 0 for "without seller", null for all. */
  sellerId: number | null
  /** A channel's id, 0 for "without channel", null for all. */
  channelId: number | null
  /** Only the points with no activation in 30 days (or never). */
  staleOnly: boolean
  query: string
}

export const NO_FILTERS: MapFilters = { area: null, sellerId: null, channelId: null, staleOnly: false, query: '' }

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const pick = (value: number | null, wanted: number | null) => wanted === null || (wanted === 0 ? value === null : value === wanted)

export function applyFilters(points: readonly MapPoint[], f: MapFilters, today: string): MapPoint[] {
  const q = fold(f.query.trim())
  return points.filter((p) =>
    (f.area === null || p.area === f.area)
    && pick(p.sellerId, f.sellerId)
    && pick(p.channelId, f.channelId)
    && (!f.staleOnly || ['stale', 'never'].includes(recencyOf(p, today).band))
    && (q.length < 2 || fold(`${p.name ?? ''} ${p.address} ${p.customerNumber ?? ''}`).includes(q)))
}

/** Areas present, sorted; for the filter. */
export const areasOf = (points: readonly MapPoint[]) => [...new Set(points.map((p) => p.area).filter((a): a is string => Boolean(a)))].sort((a, b) => a.localeCompare(b, 'es'))

export interface GroupInsight {
  key: string
  label: string
  points: number
  /** With at least one activation in 30 days. */
  active: number
  /** Share of active points, 0 to 100. */
  coverage: number
  /** No activation in 30 days, or never. */
  stale: number
  /** Average days since the last activation, among the activated ones. */
  avgDays: number | null
  rapport: number | null
}

function summarize(key: string, label: string, points: readonly MapPoint[], today: string): GroupInsight {
  const days = points.map((p) => recencyOf(p, today).days).filter((d): d is number => d !== null)
  const rated = points.map((p) => p.rapport).filter((r): r is number => r !== null)
  const active = points.filter((p) => p.visits30 > 0).length
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)
  return {
    key, label, points: points.length, active,
    coverage: points.length ? Math.round((active / points.length) * 100) : 0,
    stale: points.filter((p) => ['stale', 'never'].includes(recencyOf(p, today).band)).length,
    avgDays: avg(days), rapport: avg(rated),
  }
}

/** The whole picture, then by seller and by area: what a supervisor needs to act on. */
export function insights(points: readonly MapPoint[], sellers: readonly Named[], today: string) {
  const bySeller = [
    ...sellers.map((s) => summarize(String(s.id), s.name, points.filter((p) => p.sellerId === s.id), today)),
    summarize('none', 'Sin vendedor', points.filter((p) => p.sellerId === null), today),
  ].filter((g) => g.points > 0)
  const byArea = [...areasOf(points).map((a) => summarize(a, a, points.filter((p) => p.area === a), today)), summarize('none', 'Sin zona', points.filter((p) => !p.area), today)]
    .filter((g) => g.points > 0)
    .sort((a, b) => b.stale - a.stale || b.points - a.points)
  return { total: summarize('all', 'Todos', points, today), bySeller, byArea, unlocated: points.filter((p) => p.lat === null || p.lng === null).length }
}

type LngLat = [number, number]

/** The convex hull of some points (monotone chain), counter-clockwise, closed. */
export function convexHull(points: readonly LngLat[]): LngLat[] {
  const pts = [...new Map(points.map((p) => [`${p[0]},${p[1]}`, p])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (pts.length < 3) return pts
  const cross = (o: LngLat, a: LngLat, b: LngLat) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = (list: LngLat[]) => {
    const out: LngLat[] = []
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2] as LngLat, out[out.length - 1] as LngLat, p) <= 0) out.pop()
      out.push(p)
    }
    return out.slice(0, -1)
  }
  const ring = [...half(pts), ...half([...pts].reverse())]
  return [...ring, ring[0] as LngLat]
}

/**
 * A seller's zone: the area around their points, with a margin (about 150 m) so one or
 * two clients also make a visible zone.
 */
export function zoneOf(points: readonly LngLat[], margin = 0.0014): LngLat[] {
  if (!points.length) return []
  const around = points.flatMap(([lng, lat]) =>
    Array.from({ length: 8 }, (_, i) => [lng + margin * Math.cos((i * Math.PI) / 4), lat + margin * Math.sin((i * Math.PI) / 4)] as LngLat))
  return convexHull(around)
}
