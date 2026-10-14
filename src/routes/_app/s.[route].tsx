import { createFileRoute } from '@tanstack/react-router'
import { RoutePage } from '@/features/route/pages/RoutePage'

export const Route = createFileRoute('/_app/s/route')({
  validateSearch: (search: Record<string, unknown>): { date?: string } => ({
    date: typeof search.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? search.date : undefined,
  }),
  component: function RouteSection() {
    return <RoutePage date={Route.useSearch().date} />
  },
})
