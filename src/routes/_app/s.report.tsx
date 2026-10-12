import { createFileRoute } from '@tanstack/react-router'
import { ReportPage } from '@/features/workday/pages/ReportPage'

export const Route = createFileRoute('/_app/s/report')({
  validateSearch: (search: Record<string, unknown>): { date?: string } => ({
    date: typeof search.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? search.date : undefined,
  }),
  component: function Report() {
    return <ReportPage date={Route.useSearch().date} />
  },
})
