import { createFileRoute, redirect } from '@tanstack/react-router'
import { SignUpPage } from '@/features/auth/SignUpPage'
import { meQuery } from '@/features/auth/me'

export const Route = createFileRoute('/signup')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery)
    if (me) throw redirect({ to: '/' })
  },
  component: SignUpPage,
})
