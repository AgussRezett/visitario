import { createFileRoute } from '@tanstack/react-router'
import { UsersPage } from '@/features/admin/pages/UsersPage'

export const Route = createFileRoute('/_app/s/users')({
  component: UsersPage,
})
