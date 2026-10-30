import type { Enums } from '@/lib/supabase'

export type Role = Enums<'role'>

/** Default view when a person holds several roles: field work first. */
export const ROLE_PRIORITY: readonly Role[] = ['merchandiser', 'seller', 'supervisor', 'admin']

export const ROLE_LABEL: Record<Role, string> = {
  merchandiser: 'Activador',
  seller: 'Vendedor',
  supervisor: 'Supervisor',
  admin: 'Admin',
}

export interface ActiveMembership {
  companyId: string
  companyName: string
  /** Self-employed space: nobody assigns work, so the copy changes. */
  personal?: boolean
  roles: Role[]
  /** The company's color (#rrggbb) and logo (path in the "logos" bucket), when it set them. */
  brandColor?: string | null
  logoPath?: string | null
}

/** How a company is named in the view picker: the self-employed space reads as such. */
export const companyLabel = (m: Pick<ActiveMembership, 'companyName' | 'personal'>) => (m.personal ? 'Autónomo' : m.companyName)

export interface ViewOption {
  companyId: string
  role: Role
}

/** Every view a person can open, grouped by company, field work first within each. */
export function viewGroups(memberships: ActiveMembership[]) {
  return memberships.map((m) => ({
    companyId: m.companyId,
    label: companyLabel(m),
    personal: Boolean(m.personal),
    roles: ROLE_PRIORITY.filter((r) => m.roles.includes(r)),
  }))
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
