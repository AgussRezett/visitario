import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { ensureMe } from '@/features/auth/session'

// Visitario's own panel: only for platform admins (the database checks it again).
export const Route = createFileRoute('/_app/platform')({
  beforeLoad: async ({ context }) => {
    const me = await ensureMe(context.queryClient)
    if (!me?.isPlatformAdmin) throw redirect({ to: '/' })
  },
  component: Outlet,
})
