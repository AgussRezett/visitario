import type { Enums } from '@/lib/supabase'
import { AR_TIMEZONE, addDays, formatDayMonth, formatTime, todayInArgentina } from './dates'

/** One merchandiser's day as the supervisor sees it (from team_day). */
export interface TeamMember {
  personId: string
  firstName: string
  lastName: string
  workdayId: string | null
  workdayStatus: Enums<'workday_status'> | null
  total: number
  visited: number
  inProgress: number
  refused: number
  closed: number
  approved: number
  needsFix: number
  toReview: number
  lastActivityAt: string | null
  lastPlace: string | null
  syncPending: number
  syncFailed: number
  syncPhotos: number
  syncReportedAt: string | null
}

export type AlertKind = 'inactive' | 'unsynced' | 'failed' | 'fix' | 'refused'

export interface MemberAlert {
  kind: AlertKind
  text: string
}

/** Without activity for this long while stops remain, the supervisor is told. */
export const INACTIVE_AFTER_MIN = 60

export const minutesSince = (iso: string, now: Date) => Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000))

export function agoText(iso: string, now: Date) {
  const m = minutesSince(iso, now)
  if (m < 1) return 'recién'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `hace ${h} h ${rest} min` : `hace ${h} h`
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Working hours, "HH:MM" in Argentina. */
export interface Shift {
  start: string
  end: string
}

export type ShiftPhase = 'before' | 'during' | 'after'

const toMinutes = (t: string) => {
  const [h = 0, m = 0] = t.split(':').map(Number)
  return h * 60 + m
}
const minutesOfDay = (d: Date) => toMinutes(d.toLocaleTimeString('en-GB', { timeZone: AR_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false }))

/** "9:00", "14:30". */
export const clock = (t: string) => t.slice(0, 5).replace(/^0(\d)/, '$1')
export const shiftLabel = (s: Shift) => `${clock(s.start)} a ${clock(s.end)}`

/** Where the day stands for someone's hours; another day is before or after as a whole. */
export function shiftPhase(shift: Shift, now: Date, date = todayInArgentina(now)): ShiftPhase {
  const today = todayInArgentina(now)
  if (date !== today) return date < today ? 'after' : 'before'
  const m = minutesOfDay(now)
  return m < toMinutes(shift.start) ? 'before' : m >= toMinutes(shift.end) ? 'after' : 'during'
}

/** When today's hours started, as an instant (Argentina has no daylight saving). */
const shiftStartToday = (shift: Shift, now: Date) => new Date(`${todayInArgentina(now)}T${shift.start.slice(0, 5)}:00-03:00`)

/** The last activity in words: how long ago while working; the time once the hours are over. */
export function lastActivityText(iso: string | null, now: Date, shift?: Shift) {
  if (!iso) return 'Sin actividad'
  const day = todayInArgentina(new Date(iso))
  const time = formatTime(iso)
  if (day === todayInArgentina(now)) return !shift || shiftPhase(shift, now) === 'during' ? agoText(iso, now) : `a las ${time}`
  return day === addDays(todayInArgentina(now), -1) ? `ayer ${time}` : `${formatDayMonth(day)} ${time}`
}

/**
 * What needs the supervisor's attention for a merchandiser, most urgent first.
 * With working hours, inactivity only counts inside them: from the start of the day or the
 * last activity, whichever is later, and never once the hours are over.
 */
export function memberAlerts(m: TeamMember, now: Date, shift?: Shift, date?: string): MemberAlert[] {
  const alerts: MemberAlert[] = []
  const remaining = m.total - m.visited
  if (remaining > 0) {
    if (shift) {
      if (shiftPhase(shift, now, date) === 'during') {
        const start = shiftStartToday(shift, now)
        const last = m.lastActivityAt && new Date(m.lastActivityAt) > start ? m.lastActivityAt : null
        const since = last ?? start.toISOString()
        if (minutesSince(since, now) >= INACTIVE_AFTER_MIN) {
          alerts.push({ kind: 'inactive', text: last ? `Sin actividad ${agoText(last, now).replace('hace ', '')}` : `Sin actividad desde las ${clock(shift.start)}` })
        }
      }
    } else if (m.lastActivityAt && minutesSince(m.lastActivityAt, now) >= INACTIVE_AFTER_MIN) {
      alerts.push({ kind: 'inactive', text: `Sin actividad ${agoText(m.lastActivityAt, now).replace('hace ', '')}` })
    }
  }
  if (m.syncFailed) alerts.push({ kind: 'failed', text: plural(m.syncFailed, 'cambio rechazado', 'cambios rechazados') })
  if (m.syncPending) {
    alerts.push({ kind: 'unsynced', text: m.syncPhotos ? plural(m.syncPhotos, 'foto sin subir', 'fotos sin subir') : plural(m.syncPending, 'cambio sin subir', 'cambios sin subir') })
  }
  if (m.needsFix) alerts.push({ kind: 'fix', text: plural(m.needsFix, 'corrección', 'correcciones') })
  if (m.refused) alerts.push({ kind: 'refused', text: plural(m.refused, 'no autorizada', 'no autorizadas') })
  return alerts
}

export interface TeamTotals {
  total: number
  visited: number
  toReview: number
  needsFix: number
  refused: number
  unsyncedPhotos: number
  unsyncedPeople: number
}

export function teamTotals(members: TeamMember[]): TeamTotals {
  const sum = (f: (m: TeamMember) => number) => members.reduce((n, m) => n + f(m), 0)
  return {
    total: sum((m) => m.total),
    visited: sum((m) => m.visited),
    toReview: sum((m) => m.toReview),
    needsFix: sum((m) => m.needsFix),
    refused: sum((m) => m.refused),
    unsyncedPhotos: sum((m) => m.syncPhotos),
    unsyncedPeople: members.filter((m) => m.syncPending > 0).length,
  }
}

/** Where the merchandiser's day stands, for the assign screen chips. */
export function planLabel(m: Pick<TeamMember, 'workdayStatus' | 'total'>) {
  if (!m.workdayStatus) return 'Sin cargar'
  const stops = plural(m.total, 'local', 'locales')
  return m.workdayStatus === 'draft' ? `${stops} · sin publicar` : `${stops} · publicada`
}

/** A fix request always needs words for the merchandiser. */
export const canRequestFix = (comment: string) => comment.trim().length > 0
