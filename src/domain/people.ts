import type { Enums } from '@/lib/supabase'
import { ROLE_LABEL, ROLE_PRIORITY, type Role } from './roles'

export type MembershipStatus = Enums<'membership_status'>

/** Someone with a membership in the company, as the admin sees them. */
export interface CompanyPerson {
  membershipId: string
  personId: string
  firstName: string
  lastName: string
  roles: Role[]
  teamId: string | null
  status: MembershipStatus
  startsOn: string
  phoneLast4: string | null
  lastActivityAt: string | null
  invitedAt: string
  /** Own working hours; null = the company's. */
  shift: { start: string; end: string } | null
  /** Their finished visits are approved without review. */
  autoApprove: boolean
}

export interface Team {
  id: string
  name: string
  areas: string | null
}

export const STATUS_LABEL: Record<MembershipStatus, string> = {
  active: 'Activo',
  invited: 'Invitación enviada',
  declined: 'Invitación cancelada',
  disabled: 'Desactivado',
}

export const ROLE_HELP: Record<Role, string> = {
  merchandiser: 'Su jornada',
  supervisor: 'Su equipo',
  admin: 'Toda la empresa',
}

/** "Activador", "Supervisor · Admin": roles in their usual order. */
export const rolesLabel = (roles: Role[]) =>
  ROLE_PRIORITY.filter((r) => roles.includes(r)).map((r) => (r === 'admin' ? 'Admin de empresa' : ROLE_LABEL[r])).join(' · ')

/** Who supervises a team: active people with the supervisor role on it. */
export const supervisorsOf = (team: Team, people: CompanyPerson[]) =>
  people.filter((p) => p.teamId === team.id && p.status === 'active' && p.roles.includes('supervisor'))

/** Who works in a team: active merchandisers on it. */
export const membersOf = (team: Team, people: CompanyPerson[]) =>
  people.filter((p) => p.teamId === team.id && p.status === 'active' && p.roles.includes('merchandiser'))

export interface PeopleFilter {
  query: string
  role: Role | 'all'
  team: string | 'all' | 'none'
}

/** Search by name or the phone's last digits; filter by role and team. Active first, then invited. */
export function filterPeople(people: CompanyPerson[], f: PeopleFilter) {
  const q = f.query.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const order: Record<MembershipStatus, number> = { active: 0, invited: 1, disabled: 2, declined: 3 }
  return people
    .filter((p) => {
      const name = `${p.firstName} ${p.lastName}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      if (q && !name.includes(q) && !(p.phoneLast4 && q.replace(/\D/g, '') && p.phoneLast4.includes(q.replace(/\D/g, '')))) return false
      if (f.role !== 'all' && !p.roles.includes(f.role)) return false
      if (f.team === 'none' && p.teamId) return false
      if (f.team !== 'all' && f.team !== 'none' && p.teamId !== f.team) return false
      return true
    })
    .sort((a, b) => order[a.status] - order[b.status])
}

/** What the admin can do next with someone, by their state. */
export function nextActions(p: CompanyPerson): ('deactivate' | 'reactivate' | 'cancel' | 'reinvite' | 'share')[] {
  switch (p.status) {
    case 'active':
      return ['deactivate']
    case 'invited':
      return ['share', 'cancel']
    case 'disabled':
      return ['reactivate']
    case 'declined':
      return ['reinvite']
  }
}

/** The message the admin sends by WhatsApp (there are no SMS yet): where to go and what to use. */
export function invitationMessage(firstName: string, companyName: string, appUrl: string) {
  return `Hola ${firstName}! ${companyName} te sumó a Visitario para cargar tus jornadas. Entrá a ${appUrl} con tu DNI (o con Google) y aceptá la invitación desde tu perfil.`
}

/** WhatsApp link to that message, to the phone when we have it. */
export function whatsappLink(message: string, phone?: string | null) {
  const to = phone ? phone.replace(/\D/g, '') : ''
  return `https://wa.me/${to}?text=${encodeURIComponent(message)}`
}

/** "hace 3 min", "hace 2 h", "ayer", "hace 5 días", "hace 2 meses". */
export function lastSeen(iso: string | null, now: Date): string {
  if (!iso) return 'Sin actividad'
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'recién'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ayer'
  if (days < 30) return `hace ${days} días`
  const months = Math.floor(days / 30)
  return months === 1 ? 'hace un mes' : `hace ${months} meses`
}
