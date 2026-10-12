import { createFileRoute } from '@tanstack/react-router'
import { WorkdayPage } from '@/features/workday/pages/WorkdayPage'

export const Route = createFileRoute('/_app/s/workday')({
  validateSearch: (search: Record<string, unknown>): { date?: string } => ({
    date: typeof search.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? search.date : undefined,
  }),
  component: function Workday() {
    return <WorkdayPage date={Route.useSearch().date} />
  },
})
