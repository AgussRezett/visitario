import { createFileRoute } from '@tanstack/react-router'
import { InvitePage } from '@/features/admin/pages/InvitePage'

export const Route = createFileRoute('/_app/s/users_/new')({
  component: InvitePage,
})
