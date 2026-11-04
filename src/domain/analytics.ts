import type { Rapport } from './reputation'
import type { Consent, ReviewStatus, WorkStatus } from './visit'
import { daysBetween } from './dates'
import { matchesAny } from './filters'
import { datesOf, type Range } from './report-period'

// The reports panel's numbers, from the raw facts of a period (public.report_facts).

export interface FactVisit {
  id: string
  d: string
  m: string
  s: string
  src: 'assigned' | 'added'
  ws: WorkStatus
  rs: ReviewStatus
  c: Consent | null
  r: Rapport | null
  a: string | null
  f: string | null
  res: boolean
  area: string | null
  ch: number | null
  se: number | null
  dt: number
  da: number
  ph: number
}

export interface Facts {
  visits: FactVisit[]
  metrics: { v: string; id: number; q: number }[]
  brands: { v: string; id: number }[]
  stores: { s: string; name: string; area: string | null; ch: number | null; se: number | null; last: string | null }[]
  people: { id: string; first: string; last: string }[]
}

export const EMPTY_FACTS: Facts = { visits: [], metrics: [], brands: [], stores: [], people: [] }

/** Several values each; none means all; 0 means "without" a channel or seller. */
export interface Filter {
  people: string[]
  channels: number[]
  sellers: number[]
  areas: string[]
}

export const NO_FILTER: Filter = { people: [], channels: [], sellers: [], areas: [] }

/** Only what the filters ask for; work totals and brands follow their visits. */
export function filterFacts(f: Facts, by: Filter): Facts {
  const keep = (v: { ch: number | null; se: number | null; area: string | null }) =>
    matchesAny(v.ch, by.channels, 0) && matchesAny(v.se, by.sellers, 0) && matchesAny(v.area, by.areas, '')
  const visits = f.visits.filter((v) => keep(v) && matchesAny(v.m, by.people, ''))
  const ids = new Set(visits.map((v) => v.id))
  return { visits, metrics: f.metrics.filter((m) => ids.has(m.v)), brands: f.brands.filter((b) => ids.has(b.v)), stores: f.stores.filter(keep), people: f.people }
}

const visited = (v: FactVisit) => v.ws === 'done' || v.ws === 'refused' || v.ws === 'closed'
const minutes = (v: FactVisit) => (v.a && v.f ? (Date.parse(v.f) - Date.parse(v.a)) / 60_000 : null)

export function median(values: number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] ?? null : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2
}

export interface Summary {
  planned: number
  visited: number
  done: number
  refused: number
  closed: number
  pending: number
  /** Visited of planned, 0–1. */
  completion: number | null
  /** Activated (done) of visited, 0–1. */
  effectiveness: number | null
  extras: number
  displays: number
  arranged: number
  photos: number
  /** Median minutes in the store, of the visits done. */
  minutes: number | null
  stores: number
  people: number
  activeDays: number
  metrics: Record<number, number>
  rapport: Record<Rapport, number>
}

export function summarize(f: Facts): Summary {
  const v = f.visits
  const done = v.filter((x) => x.ws === 'done')
  const seen = v.filter(visited)
  const metrics: Record<number, number> = {}
  for (const m of f.metrics) metrics[m.id] = (metrics[m.id] ?? 0) + m.q
  const rapport: Record<Rapport, number> = { welcoming: 0, restricted: 0, indifferent: 0, unwilling: 0 }
  for (const x of seen) {
    const r = x.r ?? (x.c === 'refused' ? 'unwilling' : null)
    if (r) rapport[r] += 1
  }
  const durations = done.map(minutes).filter((n): n is number => n !== null && n > 0 && n < 8 * 60)
  return {
    planned: v.length,
    visited: seen.length,
    done: done.length,
    refused: v.filter((x) => x.ws === 'refused').length,
    closed: v.filter((x) => x.ws === 'closed').length,
    pending: v.length - seen.length,
    completion: v.length ? seen.length / v.length : null,
    effectiveness: seen.length ? done.length / seen.length : null,
    extras: seen.filter((x) => x.src === 'added').length,
    displays: done.reduce((n, x) => n + x.dt, 0),
    arranged: done.reduce((n, x) => n + x.da, 0),
    photos: v.reduce((n, x) => n + x.ph, 0),
    minutes: median(durations),
    stores: new Set(seen.map((x) => x.s)).size,
    people: new Set(seen.map((x) => x.m)).size,
    activeDays: new Set(seen.map((x) => x.d)).size,
    metrics,
    rapport,
  }
}

/** Change from the period before, as a fraction (+0.12 = 12 % more); null without a base. */
export const change = (now: number | null, before: number | null) => (now === null || before === null || before === 0 ? null : (now - before) / before)

export interface DayPoint {
  date: string
  done: number
  refused: number
  closed: number
  pending: number
  /** Work totals of the day, by metric. */
  metrics: Record<number, number>
}

/** One point per day of the range, days without visits included. */
export function daily(f: Facts, range: Range): DayPoint[] {
  const byDay = new Map(datesOf(range).map((date) => [date, { date, done: 0, refused: 0, closed: 0, pending: 0, metrics: {} as Record<number, number> }]))
  const dayOf = new Map<string, string>()
  for (const v of f.visits) {
    const p = byDay.get(v.d)
    if (!p) continue
    dayOf.set(v.id, v.d)
    if (v.ws === 'done' || v.ws === 'refused' || v.ws === 'closed') p[v.ws] += 1
    else p.pending += 1
  }
  for (const m of f.metrics) {
    const p = byDay.get(dayOf.get(m.v) ?? '')
    if (p) p.metrics[m.id] = (p.metrics[m.id] ?? 0) + m.q
  }
  return [...byDay.values()]
}

export interface PersonRow {
  personId: string
  planned: number
  visited: number
  done: number
  refused: number
  closed: number
  completion: number | null
  minutes: number | null
  arranged: number
  extras: number
  days: number
  /** Visits with a result per day worked. */
  perDay: number | null
  metrics: Record<number, number>
}

/** Each person in the period, most visits first. */
export function byPerson(f: Facts): PersonRow[] {
  const people = [...new Set(f.visits.map((v) => v.m))]
  return people
    .map((personId) => {
      const own = filterFacts(f, { ...NO_FILTER, people: [personId] })
      const s = summarize(own)
      return {
        personId, planned: s.planned, visited: s.visited, done: s.done, refused: s.refused, closed: s.closed,
        completion: s.completion, minutes: s.minutes, arranged: s.arranged, extras: s.extras, days: s.activeDays,
        perDay: s.activeDays ? s.visited / s.activeDays : null, metrics: s.metrics,
      }
    })
    .sort((a, b) => b.visited - a.visited || b.done - a.done)
}

export interface Slice {
  key: string
  visited: number
  done: number
  refused: number
  stores: number
}

/** Visits by channel, seller or zone, most first; "sin…" for those without one. */
export function breakdown(f: Facts, by: 'ch' | 'se' | 'area'): Slice[] {
  const map = new Map<string, { visited: number; done: number; refused: number; stores: Set<string> }>()
  for (const v of f.visits.filter(visited)) {
    const key = v[by] === null || v[by] === '' ? '' : String(v[by])
    const e = map.get(key) ?? { visited: 0, done: 0, refused: 0, stores: new Set<string>() }
    e.visited += 1
    if (v.ws === 'done') e.done += 1
    if (v.ws === 'refused') e.refused += 1
    e.stores.add(v.s)
    map.set(key, e)
  }
  return [...map].map(([key, e]) => ({ key, visited: e.visited, done: e.done, refused: e.refused, stores: e.stores.size })).sort((a, b) => b.visited - a.visited)
}

/** Arrivals by weekday (0 Monday … 5 Saturday, 6 Sunday) and hour, in Argentina (UTC−3, no daylight saving). */
export function heat(f: Facts): number[][] {
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0))
  for (const v of f.visits) {
    if (!v.a) continue
    const local = new Date(Date.parse(v.a) - 3 * 3_600_000)
    const day = (local.getUTCDay() + 6) % 7
    const row = grid[day]
    if (row) row[local.getUTCHours()] = (row[local.getUTCHours()] ?? 0) + 1
  }
  return grid
}

export interface Coverage {
  active: number
  visited: number
  /** Stores visited in the period, of the active ones. */
  share: number | null
  buckets: { label: string; count: number }[]
  /** The ones longest without a visit (never visited first). */
  stale: { s: string; name: string; area: string | null; days: number | null }[]
}

/** How much of the directory the team reaches, and what is waiting the longest. */
export function coverage(f: Facts, range: Range): Coverage {
  const seen = new Set(f.visits.filter(visited).map((v) => v.s))
  const ages = f.stores.map((s) => ({ s: s.s, name: s.name, area: s.area, days: s.last ? daysBetween(s.last, range.to) : null }))
  const count = (test: (d: number | null) => boolean) => ages.filter((a) => test(a.days)).length
  return {
    active: f.stores.length,
    visited: f.stores.filter((s) => seen.has(s.s)).length,
    share: f.stores.length ? f.stores.filter((s) => seen.has(s.s)).length / f.stores.length : null,
    buckets: [
      { label: 'Hasta 7 días', count: count((d) => d !== null && d <= 7) },
      { label: '8 a 14 días', count: count((d) => d !== null && d > 7 && d <= 14) },
      { label: '15 a 30 días', count: count((d) => d !== null && d > 14 && d <= 30) },
      { label: 'Más de 30 días', count: count((d) => d !== null && d > 30) },
      { label: 'Nunca', count: count((d) => d === null) },
    ],
    stale: ages.filter((a) => a.days === null || a.days > 14).sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity)).slice(0, 12),
  }
}

/** Of the visits done, how many had each brand. */
export function brandShare(f: Facts): { id: number; visits: number; share: number }[] {
  const done = new Set(f.visits.filter((v) => v.ws === 'done').map((v) => v.id))
  const counts = new Map<number, number>()
  for (const b of f.brands) if (done.has(b.v)) counts.set(b.id, (counts.get(b.id) ?? 0) + 1)
  return [...counts].map(([id, visits]) => ({ id, visits, share: done.size ? visits / done.size : 0 })).sort((a, b) => b.visits - a.visits)
}
