import { createFileRoute, redirect } from '@tanstack/react-router'
import { OnboardingPage } from '@/features/auth/pages/OnboardingPage'
import { ensureMe } from '@/features/auth/session'

export const Route = createFileRoute('/onboarding')({
  beforeLoad: async ({ context }) => {
    const me = await ensureMe(context.queryClient)
    if (!me) throw redirect({ to: '/login' })
  },
  component: OnboardingPage,
})
