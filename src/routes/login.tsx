import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { ensureMe } from '@/features/auth/session'

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    const me = await ensureMe(context.queryClient)
    if (me) throw redirect({ to: '/' })
  },
  component: LoginPage,
})
