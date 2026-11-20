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

/**
 * What the supervisor sees: the latest position and the path that led to it. With two phones
 * of the same person sending, the path is the latest phone's (mixing them zigzags); the
 * other one is counted. Imprecise readings are left out of the path.
 */
export function follow(positions: Position[], now: Date) {
  const sorted = [...positions].sort((a, b) => a.at.localeCompare(b.at))
  const last = sorted.at(-1)
  if (!last) return null
  const trail = sorted
    .filter((p) => p.device === last.device && (p.accuracy === null || p.accuracy <= MAX_ACCURACY))
    .map((p) => [p.lng, p.lat] as [number, number])
  const recent = now.getTime() - 10 * 60_000
  const devices = new Set(sorted.filter((p) => Date.parse(p.at) >= recent).map((p) => p.device))
  const minutes = Math.floor((now.getTime() - Date.parse(last.at)) / 60_000)
  return {
    last,
    trail,
    /** Over 5 minutes without news: shown greyed, "last seen". */
    stale: minutes >= 5,
    minutes,
    /** Other phones of theirs that sent in the last 10 minutes. */
    otherPhones: Math.max(0, devices.size - (devices.has(last.device) ? 1 : 0)),
  }
}
