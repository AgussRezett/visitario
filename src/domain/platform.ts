// The super admin's view of the platform (wireframes D05 / DM06): companies, plans, usage
// and read-only support sessions.
import type { Enums } from '@/lib/supabase'
import { formatBytes, type CompanyKind, type PlanKind } from './company'

export type SubscriptionStatus = Enums<'subscription_status'>

export interface PlatformCompany {
  id: string
  name: string
  kind: CompanyKind
  createdAt: string
  plan: PlanKind | null
  status: SubscriptionStatus | null
  endsOn: string | null
  members: number
  invited: number
  admins: string | null
  visits30d: number
  lastActivityAt: string | null
  photos: number
  photoBytes: number
  aiCaptures: number
  aiCostThousandths: number
  /** Until when my support session for this company is open, if it is. */
  supportUntil: string | null
}

export interface PlatformTotals {
  activePeople: number
  photos: number
  photoBytes: number
  dbBytes: number
  aiCaptures: number
  aiCostThousandths: number
}

/** What the free tiers give: R2 for photos, Supabase for the database. */
export const FREE_TIER = { photoBytes: 10e9, dbBytes: 500e6 } as const

export const PLAN_SHORT: Record<PlanKind, string> = { free: 'Gratuito', pilot: 'Piloto', team: 'Equipo', internal: 'Interno' }
export const STATUS_LABEL: Record<SubscriptionStatus, string> = { active: 'Activa', expired: 'Vencida', canceled: 'Cancelada' }
/** Company kinds the super admin can create: a personal space is created by each person. */
export const CREATABLE_KINDS = ['distributor', 'brand', 'agency'] as const satisfies readonly CompanyKind[]

/** "USD 0,21" from thousandths of a dollar. */
export function formatUsd(thousandths: number) {
  return `USD ${(thousandths / 1000).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** "8 usuarios", "1 usuario", plus the invitations still open. */
export function peopleLabel(c: Pick<PlatformCompany, 'members' | 'invited'>) {
  const members = `${c.members} ${c.members === 1 ? 'usuario' : 'usuarios'}`
  return c.invited ? `${members} · ${c.invited} ${c.invited === 1 ? 'invitado' : 'invitados'}` : members
}

/** The line under a company's name on the phone: kind, plan, people and photos. */
export function companyLine(c: PlatformCompany, kindLabel: string) {
  return [kindLabel, c.plan ? PLAN_SHORT[c.plan] : null, peopleLabel(c), c.photoBytes ? formatBytes(c.photoBytes) : null].filter(Boolean).join(' · ')
}

export function supportOpen(c: Pick<PlatformCompany, 'supportUntil'>, now: Date) {
  return Boolean(c.supportUntil && new Date(c.supportUntil) > now)
}

/** Database messages, in the words people read. */
export function platformError(message: string): string {
  if (/already exists/.test(message)) return 'Ya hay una empresa con ese nombre.'
  if (/7 or 8 digits/.test(message)) return 'El DNI tiene 7 u 8 números, sin puntos.'
  if (/new DNI needs/.test(message)) return 'Ese DNI todavía no tiene cuenta: completá nombre, apellido y celular para invitarlo.'
  if (/needs a name/.test(message)) return 'Poné el nombre de la empresa.'
  if (/10 characters/.test(message)) return 'Contá el motivo en al menos 10 caracteres.'
  if (/personal space stays/.test(message)) return 'El uso propio queda en el plan gratuito.'
  if (/support session/.test(message)) return 'La sesión de soporte terminó. Abrí otra para seguir mirando.'
  if (/Visitario admins/.test(message)) return 'Solo el equipo de Visitario puede hacer esto.'
  if (/phone/i.test(message)) return 'Revisá el celular: con código de área, sin espacios. Ej. +5491155554521.'
  return 'No se pudo guardar. Probá de nuevo.'
}

// ---- Support: a read-only look at one company

export interface SupportMember {
  name: string
  roles: Enums<'role'>[]
  status: Enums<'membership_status'>
  team: string | null
  lastVisitAt: string | null
  syncPending: number | null
  syncFailed: number | null
  syncReportedAt: string | null
}

export interface SupportDay {
  date: string
  visits: number
  finished: number
  approved: number
  photos: number
}

export interface SupportSession {
  reason: string
  startsAt: string
  endsAt: string
  by: string
}

export interface SupportSnapshot {
  name: string
  members: SupportMember[]
  teams: string[]
  days: SupportDay[]
  catalogs: { brands: number; displayTypes: number; stores: number }
  sessions: SupportSession[]
}

type Raw = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v : null)
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v ?? 0) || 0)
const list = (v: unknown): Raw[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Raw[]) : [])

/** The JSON from support_company(), checked field by field. */
export function toSupportSnapshot(json: unknown): SupportSnapshot {
  const root = (json && typeof json === 'object' ? json : {}) as Raw
  const company = (root.company && typeof root.company === 'object' ? root.company : {}) as Raw
  const catalogs = (root.catalogs && typeof root.catalogs === 'object' ? root.catalogs : {}) as Raw
  return {
    name: str(company.name) ?? '',
    members: list(root.members).map((m) => ({
      name: str(m.name) ?? '',
      roles: (Array.isArray(m.roles) ? m.roles : []) as Enums<'role'>[],
      status: (str(m.status) ?? 'active') as Enums<'membership_status'>,
      team: str(m.team),
      lastVisitAt: str(m.last_visit_at),
      syncPending: m.sync_pending === null || m.sync_pending === undefined ? null : num(m.sync_pending),
      syncFailed: m.sync_failed === null || m.sync_failed === undefined ? null : num(m.sync_failed),
      syncReportedAt: str(m.sync_reported_at),
    })),
    teams: (Array.isArray(root.teams) ? root.teams : []).filter((t): t is string => typeof t === 'string'),
    days: list(root.days).map((d) => ({ date: str(d.date) ?? '', visits: num(d.visits), finished: num(d.finished), approved: num(d.approved), photos: num(d.photos) })),
    catalogs: { brands: num(catalogs.brands), displayTypes: num(catalogs.display_types), stores: num(catalogs.stores) },
    sessions: list(root.sessions).map((s) => ({ reason: str(s.reason) ?? '', startsAt: str(s.starts_at) ?? '', endsAt: str(s.ends_at) ?? '', by: str(s.by) ?? '' })),
  }
}
