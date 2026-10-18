import { createFileRoute, redirect } from '@tanstack/react-router'
import { ensureMe } from '@/features/auth/session'
import { getActiveRole } from '@/features/auth/active-role'
import { SECTIONS } from '@/features/shell/sections'

// Entry point: sends each person to the right place for their state and role.
export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const me = await ensureMe(context.queryClient)
    if (!me) throw redirect({ to: '/login' })
    if (!me.person) throw redirect({ to: '/onboarding' })
    const active = getActiveRole(me)
    const first = active ? SECTIONS[active.role][0] : undefined
    if (!first) throw redirect({ to: '/welcome' })
    throw redirect({ to: '/s/$section', params: { section: first.slug } })
  },
})
