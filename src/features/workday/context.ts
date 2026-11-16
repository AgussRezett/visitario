import { useMe } from '@/features/auth/me'
import { useActiveRole } from '@/features/auth/active-role'
import type { Role } from '@/domain/roles'

export interface WorkContext {
  personId: string
  firstName: string
  companyId: string
  companyName: string
  /** The role being worked as (a seller sees their clients' novedades, for instance). */
  role: Role
  /** Working self-employed (personal company): no supervisor in the copy. */
  personal: boolean
}

/** Who is working and for which company (the active role's), or null without one. */
export function useWorkContext(): WorkContext | null {
  const { data: me } = useMe()
  const active = useActiveRole(me)
  if (!me?.person || !active) return null
  const membership = me.memberships.find((m) => m.companyId === active.companyId)
  return { personId: me.person.id, firstName: me.person.firstName, companyId: active.companyId, companyName: membership?.companyName ?? '', role: active.role, personal: Boolean(membership?.personal) }
}
