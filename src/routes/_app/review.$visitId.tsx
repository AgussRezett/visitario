import { createFileRoute } from '@tanstack/react-router'
import { ReviewVisitPage } from '@/features/team/pages/ReviewVisitPage'
import { fromSearch } from '@/features/shell/back'

// Full-screen on phones: its own top bar and the approve / fix footer.
export const Route = createFileRoute('/_app/review/$visitId')({
  staticData: { immersive: true },
  // Where it was opened from (an activador's day, a store), to go back there.
  validateSearch: fromSearch,
  component: function ReviewVisit() {
    return <ReviewVisitPage visitId={Route.useParams().visitId} from={Route.useSearch().from} />
  },
})
