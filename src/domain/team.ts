import type { Enums } from '@/lib/supabase'

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

/** What needs the supervisor's attention for a merchandiser, most urgent first. */
export function memberAlerts(m: TeamMember, now: Date): MemberAlert[] {
  const alerts: MemberAlert[] = []
  const remaining = m.total - m.visited
  if (m.lastActivityAt && remaining > 0 && minutesSince(m.lastActivityAt, now) >= INACTIVE_AFTER_MIN) {
    alerts.push({ kind: 'inactive', text: `Sin actividad ${agoText(m.lastActivityAt, now).replace('hace ', '')}` })
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
