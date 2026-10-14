import { createFileRoute } from '@tanstack/react-router'
import { ReportsPage } from '@/features/team/pages/ReportsPage'

export const Route = createFileRoute('/_app/s/reports')({
  validateSearch: (search: Record<string, unknown>): { date?: string } => ({
    date: typeof search.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? search.date : undefined,
  }),
  component: function Reports() {
    return <ReportsPage date={Route.useSearch().date} />
  },
})
