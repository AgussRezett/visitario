import { queryOptions, useQuery } from '@tanstack/react-query'
import { supabase, type Enums } from '@/lib/supabase'
import type { ActiveMembership } from '@/domain/roles'

export interface Invitation {
  membershipId: string
  companyName: string
  roles: Enums<'role'>[]
  startsOn: string
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
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return null
  const providers = (user.identities ?? []).map((i) => i.provider)
  const base = { userId: user.id, email: user.email ?? null, providers, hasPassword: providers.includes('email') }

  const { data: person, error } = await supabase.from('person').select('id, first_name, last_name').eq('auth_user_id', user.id).maybeSingle()
  if (error) throw error
  if (!person) return { ...base, person: null, memberships: [], invitations: [], isPlatformAdmin: false }

  const [priv, memberships, admin] = await Promise.all([
    supabase.from('person_private').select('dni, phone, birth_date').eq('person_id', person.id).single(),
    supabase.from('membership').select('id, company_id, roles, status, starts_on, company:company_id (name)').eq('person_id', person.id),
    supabase.from('platform_admin').select('person_id').eq('person_id', person.id).maybeSingle(),
  ])
  if (priv.error) throw priv.error
  if (memberships.error) throw memberships.error

  const rows = memberships.data
  return {
    ...base,
    person: { id: person.id, firstName: person.first_name, lastName: person.last_name, dni: priv.data.dni, phone: priv.data.phone, birthDate: priv.data.birth_date },
    memberships: rows.filter((m) => m.status === 'active').map((m) => ({ companyId: m.company_id, companyName: m.company?.name ?? '', roles: m.roles })),
    invitations: rows
      .filter((m) => m.status === 'invited')
      .map((m) => ({ membershipId: m.id, companyName: m.company?.name ?? 'Una empresa', roles: m.roles, startsOn: m.starts_on })),
    isPlatformAdmin: Boolean(admin.data),
  }
}

export const meQuery = queryOptions({ queryKey: ['me'], queryFn: fetchMe, staleTime: 60_000 })

export function useMe() {
  return useQuery(meQuery)
}
