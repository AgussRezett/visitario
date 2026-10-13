import { createFileRoute } from '@tanstack/react-router'
import { StorePage } from '@/features/stores/pages/StorePage'

export const Route = createFileRoute('/_app/stores/$storeId')({
  component: function Store() {
    return <StorePage storeId={Route.useParams().storeId} />
  },
})
