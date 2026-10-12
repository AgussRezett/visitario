import { createFileRoute } from '@tanstack/react-router'
import { ReviewVisitPage } from '@/features/team/pages/ReviewVisitPage'

// Full-screen on phones: its own top bar and the approve / fix footer.
export const Route = createFileRoute('/_app/review/$visitId')({
  staticData: { immersive: true },
  component: function ReviewVisit() {
    return <ReviewVisitPage visitId={Route.useParams().visitId} />
  },
})
