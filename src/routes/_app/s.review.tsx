import { createFileRoute } from '@tanstack/react-router'
import { isoDate, oneOf, uuid } from '@/lib/search'
import { ReviewPage, type ReviewSearch } from '@/features/team/pages/ReviewPage'

const tab = oneOf(['to_review', 'needs_fix', 'approved', 'all'] as const)

export const Route = createFileRoute('/_app/s/review')({
  validateSearch: (search: Record<string, unknown>): ReviewSearch => ({ tab: tab(search.tab), visit: uuid(search.visit), date: isoDate(search.date) }),
  component: function Review() {
    return <ReviewPage {...Route.useSearch()} />
  },
})
