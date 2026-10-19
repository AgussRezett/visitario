import { createFileRoute, redirect } from '@tanstack/react-router'
import { ensureMe } from '@/features/auth/session'
import { pendingInvite } from '@/features/invitations/pending'
import { getActiveRole } from '@/features/auth/active-role'
import { SECTIONS } from '@/features/shell/sections'

// Entry point: sends each person to the right place for their state and role.
export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const me = await ensureMe(context.queryClient)
    if (!me) throw redirect({ to: '/login' })
    if (!me.person) throw redirect({ to: '/onboarding' })
    // Came from an invitation's link (signed in, with Google, or after the profile): back to it.
    const invite = pendingInvite()
    if (invite) throw redirect({ to: '/invitacion/$token', params: { token: invite } })
    const active = getActiveRole(me)
    const first = active ? SECTIONS[active.role][0] : undefined
    if (!first) throw redirect({ to: '/welcome' })
    throw redirect({ to: '/s/$section', params: { section: first.slug } })
  },
})
