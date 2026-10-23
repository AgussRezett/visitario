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

interface IdentityRow {
  has_password: boolean
  person: { id: string; first_name: string; last_name: string; dni: string; phone: string | null; birth_date: string | null } | null
  memberships: { id: string; company_id: string; roles: Enums<'role'>[]; status: Enums<'membership_status'>; starts_on: string; company: { name: string; kind: Enums<'company_kind'> } | null }[]
  is_platform_admin: boolean
  invitations: { id: string; company: string; roles: Enums<'role'>[]; starts_on: string; expires_at: string | null; inviter: string | null }[]
}

/** Two requests: the session's user (checked by the server) and everything else in one read. */
async function fetchMe(): Promise<Me | null> {
  const { data: auth, error: authError } = await supabase.auth.getUser()
  // No signal is not "signed out": keep the copy on the phone instead of losing the day.
  if (authError && isAuthRetryableFetchError(authError)) throw authError
  const user = auth.user
  if (!user) return null
  const providers = (user.identities ?? []).map((i) => i.provider)
  const { data, error } = await supabase.rpc('my_identity')
  if (error) throw error
  const id = data as unknown as IdentityRow
  // A Google user who later sets a password gets no 'email' identity: the server knows.
  const base = { userId: user.id, email: user.email ?? null, providers, hasPassword: providers.includes('email') || id.has_password }
  const person = id.person
  if (!person) return { ...base, person: null, memberships: [], invitations: [], isPlatformAdmin: false }

  const rows = id.memberships ?? []
  return {
    ...base,
    person: { id: person.id, firstName: person.first_name, lastName: person.last_name, dni: person.dni, phone: person.phone, birthDate: person.birth_date },
    memberships: rows.filter((m) => m.status === 'active').map((m) => ({ companyId: m.company_id, companyName: m.company?.name ?? '', personal: m.company?.kind === 'personal', roles: m.roles })),
    invitations: [
      ...(id.invitations ?? []).map((i): Invitation => ({ kind: 'email', id: i.id, companyName: i.company, roles: i.roles, startsOn: i.starts_on, expiresAt: i.expires_at, inviter: i.inviter })),
      ...rows
        .filter((m) => m.status === 'invited')
        .map((m): Invitation => ({ kind: 'membership', id: m.id, companyName: m.company?.name ?? 'Una empresa', roles: m.roles, startsOn: m.starts_on, expiresAt: null, inviter: null })),
    ],
    isPlatformAdmin: id.is_platform_admin === true,
  }
}

// Who I am changes rarely (a new role, an invitation): screens that need it fresh refresh it.
export const meQuery = queryOptions({ queryKey: ['me'], queryFn: fetchMe, staleTime: 5 * 60_000 })

/**
 * Fetches "me" again and waits for it. Use after anything that changes the session or the
 * person. Unlike invalidateQueries, it also refreshes when no screen is showing "me" yet
 * (the login page), so route guards never read the signed-out copy.
 */
export function refreshMe(queryClient: QueryClient) {
  return queryClient.fetchQuery({ ...meQuery, staleTime: 0 })
}

/** `fresh`: the profile shows invitations and roles, so it asks again after a minute. */
export function useMe(fresh = false) {
  return useQuery(fresh ? { ...meQuery, staleTime: 60_000 } : meQuery)
}
