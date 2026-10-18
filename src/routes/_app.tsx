import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { useMe } from '@/features/auth/me'
import { ensureMe } from '@/features/auth/session'
import { useActiveRole } from '@/features/auth/active-role'
import { AppShell } from '@/features/shell/components/AppShell'
import { FullScreenSpinner } from '@/ui/Spinner'

// Signed-in area: requires a session and a completed identity.
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context }) => {
    const me = await ensureMe(context.queryClient)
    if (!me) throw redirect({ to: '/login' })
    if (!me.person) throw redirect({ to: '/onboarding' })
  },
  component: AppLayout,
})

function AppLayout() {
  const { data: me } = useMe()
  const active = useActiveRole(me)
  if (!me?.person) return <FullScreenSpinner />
  return (
    <AppShell me={{ ...me, person: me.person }} active={active}>
      <Outlet />
    </AppShell>
  )
}
