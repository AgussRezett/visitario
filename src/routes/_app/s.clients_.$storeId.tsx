import { createFileRoute } from '@tanstack/react-router'
import { ClientPage } from '@/features/stores/pages/ClientPage'

// A seller's client, with its history (under Clientes in the navigation).
export const Route = createFileRoute('/_app/s/clients_/$storeId')({
  component: function Client() {
    return <ClientPage storeId={Route.useParams().storeId} />
  },
})
