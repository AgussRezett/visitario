import { createFileRoute } from '@tanstack/react-router'
import { oneOf } from '@/lib/search'
import { IssuesPage, type IssuesSearch } from '@/features/issues/pages/IssuesPage'

const tab = oneOf(['open', 'resolved'] as const)

export const Route = createFileRoute('/_app/s/issues')({
  validateSearch: (search: Record<string, unknown>): IssuesSearch => ({ tab: tab(search.tab) }),
  component: function Issues() {
    return <IssuesPage {...Route.useSearch()} />
  },
})
