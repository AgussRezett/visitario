import { formatHour, formatTime } from './dates'
import { isVisited, type WorkStatus } from './visit'

/** What the supervisor's read-only view of an activador's day needs from each stop. */
export interface DayStop {
  id: string
  workStatus: WorkStatus
  source: 'assigned' | 'added'
  addedByName: string | null
  /** Added by the activador whose day it is. */
  addedByMe: boolean
  arrivedAt: string | null
  finishedAt: string | null
  retryAfter: string | null
}

/** The stop the activador is at now, and the one that comes next in their order. */
export function dayFocus(stops: Pick<DayStop, 'id' | 'workStatus'>[]): { currentId: string | null; nextId: string | null } {
  const current = stops.find((s) => s.workStatus === 'in_progress') ?? null
  const next = stops.find((s) => s.workStatus === 'pending') ?? null
  return { currentId: current?.id ?? null, nextId: next?.id ?? null }
}

/** Who put the stop in the day, in the supervisor's words. */
export function stopOrigin(s: Pick<DayStop, 'source' | 'addedByName' | 'addedByMe'>, member: string): string {
  if (s.source === 'added') return `Agregada por ${s.addedByMe ? member : (s.addedByName ?? member)}`
  return s.addedByName ? `Asignada por ${s.addedByName}` : 'Asignada'
}

/** When something happened at the store, in a few words. */
export function stopTiming(s: Pick<DayStop, 'workStatus' | 'arrivedAt' | 'finishedAt' | 'retryAfter'>): string | null {
  if (s.workStatus === 'closed' && s.retryAfter) return `Vuelve ${formatHour(s.retryAfter)}`
  if (isVisited(s.workStatus) && s.finishedAt) return `Terminó ${formatTime(s.finishedAt)}`
  if (s.workStatus === 'in_progress' && s.arrivedAt) return `Llegó ${formatTime(s.arrivedAt)}`
  return null
}
