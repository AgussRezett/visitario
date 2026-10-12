import { createFileRoute, redirect } from '@tanstack/react-router'
import { OnboardingPage } from '@/features/auth/OnboardingPage'
import { meQuery } from '@/features/auth/me'

export const Route = createFileRoute('/onboarding')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery)
    if (!me) throw redirect({ to: '/login' })
  },
  component: OnboardingPage,
})
