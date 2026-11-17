import { createFileRoute } from '@tanstack/react-router'
import { isoDate, uuid } from '@/lib/search'
import { PlanRoutePage, type PlanSearch } from '@/features/routeplan/pages/PlanRoutePage'

// Armar recorrido (supervisors and admins): ?date is the day planned, ?person who it is for.
export const Route = createFileRoute('/_app/s/plan')({
  validateSearch: (search: Record<string, unknown>): PlanSearch => ({ date: isoDate(search.date), person: uuid(search.person) }),
  component: function PlanRoute() {
    return <PlanRoutePage {...Route.useSearch()} />
  },
})
