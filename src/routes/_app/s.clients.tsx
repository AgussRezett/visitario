import { createFileRoute } from '@tanstack/react-router'
import { ClientsPage } from '@/features/stores/pages/ClientsPage'

export const Route = createFileRoute('/_app/s/clients')({
  component: ClientsPage,
})
