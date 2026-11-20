// Following an activador during their workday: when their phone sends where it is, which
// path the supervisor sees, and how fresh the position is. Pure: no browser, no Supabase.
import { distanceKm, type Point } from './route'
import { isVisited, type WorkStatus } from './visit'

export interface Fix extends Point {
  /** Meters, as the phone says it. */
  accuracy: number
  at: number
}

export interface Position extends Point {
  device: string
  accuracy: number | null
  at: string
}

/** A position worse than this is a guess (a phone indoors without GPS): not sent. */
export const MAX_ACCURACY = 150
/** At most one every 30 s standing still; every 10 s when walking at least 40 m. */
const EVERY_MS = 30_000
const MOVING_MS = 10_000
const MOVED_M = 40

/** Whether this reading goes out, given the last one sent. */
export function shouldSend(last: Fix | null, next: Fix): boolean {
  if (next.accuracy > MAX_ACCURACY) return false
  if (!last) return true
  const since = next.at - last.at
  if (since >= EVERY_MS) return true
  return since >= MOVING_MS && distanceKm(last, next) * 1000 >= MOVED_M
}

/**
 * The day is under way, so the phone shares: today's workday is published, it has started
 * (someone arrived at a stop) and some stop is still to do.
 */
export function sharesDay(status: string, visits: { workStatus: WorkStatus; arrivedAt: string | null }[]): boolean {
  return status !== 'draft'
    && visits.some((v) => v.arrivedAt !== null || v.workStatus !== 'pending')
    && visits.some((v) => !isVisited(v.workStatus))
}

/** A stop of the day, with when they got there and left (the app records it). */
export interface StopTimes {
  name: string
  /** Null for a store not located yet: it counts for where they are, not on the map. */
  lat: number | null
  lng: number | null
  workStatus: WorkStatus
  arrivedAt: string | null
  finishedAt: string | null
}

/** The latest thing known of where they are: a phone position, or a stop they reached or left. */
export interface Last extends Point {
  at: string
  /** Set when it came from the phone; a stop's arrival or departure otherwise. */
  device: string | null
}

/**
 * What the supervisor sees: where they were last known to be and the path that led there.
 * The phone only sends with the app open, so the path also goes through each stop at the
 * time they arrived and left: between stops (the app closed in a pocket) it is a straight
 * line, not the streets. With two phones of the same person, only the latest phone's
 * positions count (mixing them zigzags); the other one is counted. Imprecise readings are
 * left out.
 */
export function follow(positions: Position[], now: Date, stops: StopTimes[] = []) {
  const sorted = [...positions].sort((a, b) => a.at.localeCompare(b.at))
  const phone = sorted.at(-1)?.device ?? null
  const events: Last[] = [
    ...sorted.filter((p) => p.device === phone && (p.accuracy === null || p.accuracy <= MAX_ACCURACY))
      .map((p) => ({ lat: p.lat, lng: p.lng, at: p.at, device: p.device })),
    ...stops.flatMap(({ lat, lng, arrivedAt, finishedAt }) => (lat === null || lng === null ? [] : [arrivedAt, finishedAt]
      .filter((t): t is string => t !== null)
      .map((at): Last => ({ lat, lng, at, device: null })))),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  const last = events.at(-1)
  if (!last) return null
  const recent = now.getTime() - 10 * 60_000
  const devices = new Set(sorted.filter((p) => Date.parse(p.at) >= recent).map((p) => p.device))
  const minutes = Math.floor((now.getTime() - Date.parse(last.at)) / 60_000)
  return {
    last,
    trail: events.slice(0, -1).map((e) => [e.lng, e.lat] as [number, number]),
    /** Over 5 minutes without news: shown greyed, "last seen". */
    stale: minutes >= 5,
    minutes,
    /** Other phones of theirs that sent in the last 10 minutes. */
    otherPhones: Math.max(0, devices.size - (phone && devices.has(phone) ? 1 : 0)),
  }
}

export type Whereabouts =
  | { kind: 'at'; place: string; since: string }
  | { kind: 'between'; from: string; left: string; to: StopTimes }
  | { kind: 'done' }

/**
 * Where they are in the day, from the stops alone: at a stop (one in progress), on the way
 * from the last one they left to the next one in their order, or done. Null before starting.
 */
export function whereabouts(stops: StopTimes[]): Whereabouts | null {
  const at = stops.find((s) => s.workStatus === 'in_progress')
  if (at) return { kind: 'at', place: at.name, since: at.arrivedAt ?? '' }
  const left = stops.filter((s) => s.finishedAt !== null).sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))[0]
  if (!left?.finishedAt) return null
  const next = stops.find((s) => !isVisited(s.workStatus))
  return next ? { kind: 'between', from: left.name, left: left.finishedAt, to: next } : { kind: 'done' }
}
