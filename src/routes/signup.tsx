import { createFileRoute, redirect } from '@tanstack/react-router'
import { SignUpPage } from '@/features/auth/pages/SignUpPage'
import { ensureMe } from '@/features/auth/session'

export const Route = createFileRoute('/signup')({
  beforeLoad: async ({ context }) => {
    const me = await ensureMe(context.queryClient)
    if (me) throw redirect({ to: '/' })
  },
  component: SignUpPage,
})
