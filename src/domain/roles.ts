import type { Enums } from '@/lib/supabase'

export type Role = Enums<'role'>

/** Default view when a person holds several roles: field work first. */
export const ROLE_PRIORITY: readonly Role[] = ['merchandiser', 'supervisor', 'admin']

export const ROLE_LABEL: Record<Role, string> = {
  merchandiser: 'Activador',
  supervisor: 'Supervisor',
  admin: 'Admin',
}

export interface ActiveMembership {
  companyId: string
  companyName: string
  roles: Role[]
}

/** Picks the view to open: the stored one if still valid, else the first by priority. */
export function pickActiveRole(memberships: ActiveMembership[], stored: { companyId: string; role: Role } | null) {
  if (stored) {
    const m = memberships.find((x) => x.companyId === stored.companyId)
    if (m?.roles.includes(stored.role)) return { companyId: m.companyId, role: stored.role }
  }
  for (const role of ROLE_PRIORITY) {
    const m = memberships.find((x) => x.roles.includes(role))
    if (m) return { companyId: m.companyId, role }
  }
  return null
}
