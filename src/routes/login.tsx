import { createFileRoute, redirect } from '@tanstack/react-router'
import { LoginPage } from '@/features/auth/LoginPage'
import { meQuery } from '@/features/auth/me'

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery)
    if (me) throw redirect({ to: '/' })
  },
  component: LoginPage,
})
