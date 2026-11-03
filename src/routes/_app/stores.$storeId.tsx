import { createFileRoute } from '@tanstack/react-router'
import { StorePage } from '@/features/stores/pages/StorePage'
import { fromSearch } from '@/features/shell/back'

export const Route = createFileRoute('/_app/stores/$storeId')({
  // Where the store was opened from (an activador's day, say), to go back there.
  validateSearch: fromSearch,
  component: function Store() {
    return <StorePage storeId={Route.useParams().storeId} from={Route.useSearch().from} />
  },
})
