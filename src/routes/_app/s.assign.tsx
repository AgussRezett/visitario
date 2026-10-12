import { createFileRoute } from '@tanstack/react-router'
import { isoDate, uuid } from '@/lib/search'
import { AssignPage, type AssignSearch } from '@/features/team/pages/AssignPage'

export const Route = createFileRoute('/_app/s/assign')({
  validateSearch: (search: Record<string, unknown>): AssignSearch => ({ date: isoDate(search.date), person: uuid(search.person) }),
  component: function Assign() {
    return <AssignPage {...Route.useSearch()} />
  },
})
