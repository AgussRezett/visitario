import { createFileRoute } from '@tanstack/react-router'
import { isoDate } from '@/lib/search'
import { TodayPage } from '@/features/team/pages/TodayPage'

export const Route = createFileRoute('/_app/s/today')({
  validateSearch: (search: Record<string, unknown>): { date?: string } => ({ date: isoDate(search.date) }),
  component: function Today() {
    return <TodayPage date={Route.useSearch().date} />
  },
})
