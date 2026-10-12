import { useMe } from '@/features/auth/me'
import { useActiveRole } from '@/features/auth/active-role'

export interface WorkContext {
  personId: string
  firstName: string
  companyId: string
  companyName: string
}

/** Who is working and for which company (the active role's), or null without one. */
export function useWorkContext(): WorkContext | null {
  const { data: me } = useMe()
  const active = useActiveRole(me)
  if (!me?.person || !active) return null
  const membership = me.memberships.find((m) => m.companyId === active.companyId)
  return { personId: me.person.id, firstName: me.person.firstName, companyId: active.companyId, companyName: membership?.companyName ?? '' }
}
