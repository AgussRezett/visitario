import { createFileRoute, redirect } from '@tanstack/react-router'
import { ensureMe } from '@/features/auth/session'
import { WelcomePage } from '@/features/shell/pages/WelcomePage'

// Standalone (outside the app shell): there is no role yet, so there is no navigation to show.
export const Route = createFileRoute('/welcome')({
  beforeLoad: async ({ context }) => {
    const me = await ensureMe(context.queryClient)
    if (!me) throw redirect({ to: '/login' })
    if (!me.person) throw redirect({ to: '/onboarding' })
    if (me.memberships.length) throw redirect({ to: '/' })
  },
  component: WelcomePage,
})
