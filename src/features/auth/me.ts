import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { supabase, type Enums } from '@/lib/supabase'
import type { ActiveMembership } from '@/domain/roles'

export interface Invitation {
  /** An email invitation for my DNI, or a membership an admin left invited (before emails). */
  kind: 'email' | 'membership'
  id: string
  companyName: string
  roles: Enums<'role'>[]
  startsOn: string
  /** Email invitations last an hour. */
  expiresAt: string | null
  inviter: string | null
}

export interface Me {
  userId: string
  email: string | null
  hasPassword: boolean
  providers: string[]
  person: { id: string; firstName: string; lastName: string; dni: string; phone: string | null; birthDate: string | null } | null
  memberships: ActiveMembership[]
  invitations: Invitation[]
  isPlatformAdmin: boolean
}

async function fetchMe(): Promise<Me | null> {
  const { data: auth, error: authError } = await supabase.auth.getUser()
  // No signal is not "signed out": keep the copy on the phone instead of losing the day.
  if (authError && isAuthRetryableFetchError(authError)) throw authError
  const user = auth.user
  if (!user) return null
  const providers = (user.identities ?? []).map((i) => i.provider)
  // A Google user who later sets a password gets no 'email' identity, so ask the server.
  let hasPassword = providers.includes('email')
  if (!hasPassword) {
    const { data } = await supabase.rpc('has_password')
    hasPassword = data === true
  }
  const base = { userId: user.id, email: user.email ?? null, providers, hasPassword }

  const { data: person, error } = await supabase.from('person').select('id, first_name, last_name').eq('auth_user_id', user.id).maybeSingle()
  if (error) throw error
  if (!person) return { ...base, person: null, memberships: [], invitations: [], isPlatformAdmin: false }

  const [priv, memberships, admin, emailInvites] = await Promise.all([
    supabase.from('person_private').select('dni, phone, birth_date').eq('person_id', person.id).single(),
    supabase.from('membership').select('id, company_id, roles, status, starts_on, company:company_id (name, kind)').eq('person_id', person.id),
    supabase.from('platform_admin').select('person_id').eq('person_id', person.id).maybeSingle(),
    supabase.rpc('my_invitations'),
  ])
  if (priv.error) throw priv.error
  if (memberships.error) throw memberships.error

  const rows = memberships.data
  return {
    ...base,
    person: { id: person.id, firstName: person.first_name, lastName: person.last_name, dni: priv.data.dni, phone: priv.data.phone, birthDate: priv.data.birth_date },
    memberships: rows.filter((m) => m.status === 'active').map((m) => ({ companyId: m.company_id, companyName: m.company?.name ?? '', personal: m.company?.kind === 'personal', roles: m.roles })),
    invitations: [
      ...(emailInvites.data ?? []).map((i): Invitation => ({ kind: 'email', id: i.id, companyName: i.company, roles: i.roles, startsOn: i.starts_on, expiresAt: i.expires_at, inviter: i.inviter })),
      ...rows
        .filter((m) => m.status === 'invited')
        .map((m): Invitation => ({ kind: 'membership', id: m.id, companyName: m.company?.name ?? 'Una empresa', roles: m.roles, startsOn: m.starts_on, expiresAt: null, inviter: null })),
    ],
    isPlatformAdmin: Boolean(admin.data),
  }
}

export const meQuery = queryOptions({ queryKey: ['me'], queryFn: fetchMe, staleTime: 60_000 })

/**
 * Fetches "me" again and waits for it. Use after anything that changes the session or the
 * person. Unlike invalidateQueries, it also refreshes when no screen is showing "me" yet
 * (the login page), so route guards never read the signed-out copy.
 */
export function refreshMe(queryClient: QueryClient) {
  return queryClient.fetchQuery({ ...meQuery, staleTime: 0 })
}

export function useMe() {
  return useQuery(meQuery)
}
