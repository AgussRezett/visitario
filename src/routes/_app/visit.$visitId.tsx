import { createFileRoute } from '@tanstack/react-router'
import { VisitPage } from '@/features/workday/pages/VisitPage'

// Full-screen on phones: the visit sheet has its own top bar and footer.
export const Route = createFileRoute('/_app/visit/$visitId')({
  staticData: { immersive: true },
  component: function Visit() {
    return <VisitPage visitId={Route.useParams().visitId} />
  },
})
