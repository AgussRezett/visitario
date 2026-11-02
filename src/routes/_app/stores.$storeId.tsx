import { createFileRoute } from '@tanstack/react-router'
import { StorePage } from '@/features/stores/pages/StorePage'

export const Route = createFileRoute('/_app/stores/$storeId')({
  // Where the store was opened from (an activador's day, say), to go back there.
  validateSearch: (search: Record<string, unknown>): { from?: string } =>
    typeof search.from === 'string' && search.from.startsWith('/') && !search.from.startsWith('//') ? { from: search.from } : {},
  component: function Store() {
    return <StorePage storeId={Route.useParams().storeId} from={Route.useSearch().from} />
  },
})
