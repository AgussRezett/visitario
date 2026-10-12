import { createFileRoute, redirect } from '@tanstack/react-router'
import { meQuery } from '@/features/auth/me'
import { NoMembership } from '@/features/shell/NoMembership'

// Standalone (outside the app shell): there is no role yet, so there is no navigation to show.
export const Route = createFileRoute('/welcome')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery)
    if (!me) throw redirect({ to: '/login' })
    if (!me.person) throw redirect({ to: '/onboarding' })
    if (me.memberships.length) throw redirect({ to: '/' })
  },
  component: NoMembership,
})
