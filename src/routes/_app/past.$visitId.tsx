import { createFileRoute } from '@tanstack/react-router'
import { PastVisitPage } from '@/features/workday/pages/PastVisitPage'
import { fromSearch } from '@/features/shell/back'

// Full-screen on phones, like the visit it is opened from; ?from= is the way back to it.
export const Route = createFileRoute('/_app/past/$visitId')({
  staticData: { immersive: true },
  validateSearch: fromSearch,
  component: function PastVisit() {
    return <PastVisitPage visitId={Route.useParams().visitId} from={Route.useSearch().from} />
  },
})
