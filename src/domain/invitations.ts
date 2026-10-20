// Invitations by email: an admin invites by DNI + email; the link lasts an hour.
import type { Role } from './roles'

export const INVITE_MINUTES = 60

/** How an open invitation reads in the admin's list. */
export type InviteState = 'sent' | 'sending' | 'failed' | 'expired'

export interface AdminInvitation {
  id: string
  dni: string
  email: string
  roles: Role[]
  teamId: string | null
  startsOn: string
  expiresAt: string
  sentAt: string | null
  sendError: string | null
  sends: number
  createdAt: string
}

export function inviteState(i: Pick<AdminInvitation, 'expiresAt' | 'sentAt' | 'sendError'>, now: Date): InviteState {
  if (new Date(i.expiresAt) <= now) return 'expired'
  if (i.sendError) return 'failed'
  return i.sentAt ? 'sent' : 'sending'
}

export const INVITE_STATE_LABEL: Record<InviteState, string> = {
  sent: 'Enviada',
  sending: 'Enviando',
  failed: 'No se pudo enviar',
  expired: 'Vencida',
}

/** "vence en 42 min", "vence en 1 min", "venció hace 3 h", "venció hace 2 días". */
export function timeLeft(expiresAt: string, now: Date) {
  const minutes = Math.round((new Date(expiresAt).getTime() - now.getTime()) / 60_000)
  if (minutes > 0) return `vence en ${minutes} min`
  const ago = -minutes
  if (ago < 60) return `venció hace ${Math.max(1, ago)} min`
  if (ago < 48 * 60) return `venció hace ${Math.round(ago / 60)} h`
  return `venció hace ${Math.round(ago / 1440)} días`
}

const ROLE_PHRASE: Record<Role, string> = { merchandiser: 'activador', seller: 'vendedor', supervisor: 'supervisor', admin: 'admin de la empresa' }

/** "activador", "activador y supervisor". */
export function rolesPhrase(roles: readonly Role[]) {
  return roles.map((r) => ROLE_PHRASE[r]).join(' y ')
}

/** The WhatsApp message with the link, for when the email did not go out. */
export function inviteMessage(company: string, link: string) {
  return `Hola! Te invito a sumarte a ${company} en Visitario. Aceptá desde este enlace (vence en 1 hora): ${link}`
}

/** What the link's page shows, from invitation_preview(). */
export type LinkState = 'invalid' | 'expired' | 'canceled' | 'declined' | 'accepted' | 'pending'

export interface LinkPreview {
  state: LinkState
  company: string
  inviter: string
  roles: Role[]
  email: string
  expiresAt: string | null
  dniEnd: string
  hasAccount: boolean
}

export function toLinkPreview(json: unknown): LinkPreview {
  const r = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>
  const states: LinkState[] = ['invalid', 'expired', 'canceled', 'declined', 'accepted', 'pending']
  const state = states.find((s) => s === r.state) ?? 'invalid'
  return {
    state,
    company: typeof r.company === 'string' ? r.company : '',
    inviter: typeof r.inviter === 'string' ? r.inviter : '',
    roles: (Array.isArray(r.roles) ? r.roles : []) as Role[],
    email: typeof r.email === 'string' ? r.email : '',
    expiresAt: typeof r.expires_at === 'string' ? r.expires_at : null,
    dniEnd: typeof r.dni_end === 'string' ? r.dni_end : '',
    hasAccount: r.has_account === true,
  }
}

/** Database and function messages, in the words people read. */
export function inviteError(message: string): string {
  if (/Already a member/.test(message)) return 'Esa persona ya es parte de la empresa.'
  if (/another DNI/.test(message)) return 'Esta invitación es para otro DNI.'
  if (/expired/.test(message)) return 'La invitación venció. Pedile a quien te invitó que te la reenvíe.'
  if (/already answered/.test(message)) return 'Esta invitación ya se usó.'
  if (/identity/i.test(message)) return 'Primero completá tus datos.'
  if (/email_taken/.test(message)) return 'Ese email ya tiene cuenta en Visitario: entrá con tu contraseña o con Google.'
  if (/personal company/.test(message)) return 'El uso propio no puede invitar a otras personas.'
  if (/Only an admin/.test(message)) return 'Solo un admin de la empresa puede invitar.'
  if (/invalid/.test(message)) return 'Revisá el DNI y el email.'
  return 'No se pudo completar. Probá de nuevo.'
}
