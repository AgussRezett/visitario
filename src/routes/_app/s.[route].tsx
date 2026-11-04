import { createFileRoute } from '@tanstack/react-router'
import { RoutePage } from '@/features/route/pages/RoutePage'

export const Route = createFileRoute('/_app/s/route')({
  validateSearch: (search: Record<string, unknown>): { date?: string } => ({
    date: typeof search.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? search.date : undefined,
  }),
  component: function RouteSection() {
    const { date } = Route.useSearch()
    // Another day starts clean: its own options and its own route.
    return <RoutePage key={date ?? 'today'} date={date} />
  },
})
