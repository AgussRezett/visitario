import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { inviteError, toLinkPreview, type AdminInvitation } from '@/domain/invitations'
import type { Role } from '@/domain/roles'

/** A refusal already in Spanish. */
export class InviteError extends Error {}

const keys = {
  list: (companyId: string) => ['invitations', companyId] as const,
  preview: (token: string) => ['invitation-preview', token] as const,
}

/** The function's own error code ({ error }) when it answered with one. */
async function functionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const body = (await error.context.json().catch(() => null)) as { error?: string } | null
    return body?.error ?? ''
  }
  return ''
}

export interface SentInvitation {
  id: string
  link: string
  sent: boolean
  /** Why the email did not go out: not_configured, rejected (auth, limits) or unreachable. */
  error?: string
}

async function invoke(body: Record<string, unknown>): Promise<SentInvitation> {
  const { data, error } = await supabase.functions.invoke<SentInvitation>('invitation', { body: { ...body, origin: window.location.origin } })
  if (error || !data) throw new InviteError(inviteError(await functionError(error)))
  return data
}

/** Open invitations of the company (pending, sent or not, expired or not), newest first. */
export const invitationsQuery = (companyId: string) =>
  queryOptions({
    queryKey: keys.list(companyId),
    queryFn: async (): Promise<AdminInvitation[]> => {
      const { data, error } = await supabase
        .from('invitation')
        .select('id, dni, email, roles, team_id, starts_on, expires_at, sent_at, send_error, sends, created_at')
        .eq('company_id', companyId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data.map((i) => ({
        id: i.id, dni: i.dni, email: i.email, roles: i.roles, teamId: i.team_id, startsOn: i.starts_on,
        expiresAt: i.expires_at, sentAt: i.sent_at, sendError: i.send_error, sends: i.sends, createdAt: i.created_at,
      }))
    },
  })

export interface NewInvitation {
  dni: string
  email: string
  roles: Role[]
  teamId: string | null
  startsOn: string
}

export function useInvitations(companyId: string) {
  const qc = useQueryClient()
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: keys.list(companyId) }), qc.invalidateQueries({ queryKey: ['admin', 'people', companyId] })])

  const create = useMutation({
    mutationFn: (i: NewInvitation) => invoke({ action: 'create', companyId, dni: i.dni, email: i.email, roles: i.roles, teamId: i.teamId, startsOn: i.startsOn }),
    onSettled: refresh,
  })
  const resend = useMutation({
    mutationFn: (invitationId: string) => invoke({ action: 'resend', invitationId }),
    onSettled: refresh,
  })
  const cancel = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase.rpc('cancel_invitation', { p_invitation: invitationId })
      if (error) throw new InviteError(inviteError(error.message))
    },
    onSettled: refresh,
  })
  return { create, resend, cancel }
}

/** Super admin: a new company's first admin, invited the same way. */
export const inviteToCompany = (companyId: string, i: NewInvitation) =>
  invoke({ action: 'create', companyId, dni: i.dni, email: i.email, roles: i.roles, teamId: i.teamId, startsOn: i.startsOn })

// ---- The invited person

export const previewQuery = (token: string) =>
  queryOptions({
    queryKey: keys.preview(token),
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('invitation_preview', { p_token: token })
      if (error) throw error
      return toLinkPreview(data)
    },
  })

/** Creates the invited email's account (confirmed by the link) and signs in. */
export async function signUpFromInvitation(token: string, password: string) {
  const { data, error } = await supabase.functions.invoke<{ email: string }>('invitation', { body: { action: 'signup', token, password } })
  if (error || !data) throw new InviteError(inviteError(await functionError(error)))
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: data.email, password })
  if (signInError) throw new InviteError('La cuenta se creó, pero no pudimos entrar. Probá con tu email y contraseña.')
}

export interface Answered {
  companyId: string
  company: string
  roles: Role[]
}

/** Accept or decline, by the link's token or (from the profile) by id. */
export async function answerInvitation(by: { token: string } | { id: string }, accept: boolean): Promise<Answered> {
  const { data, error } = await supabase.rpc('accept_invitation', {
    ...('token' in by ? { p_token: by.token } : { p_invitation: by.id }),
    p_accept: accept,
  })
  if (error) throw new InviteError(inviteError(error.message))
  const r = (data ?? {}) as { company_id?: string; company?: string; roles?: Role[] }
  return { companyId: r.company_id ?? '', company: r.company ?? '', roles: r.roles ?? [] }
}
