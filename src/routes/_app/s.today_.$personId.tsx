import { createFileRoute } from '@tanstack/react-router'
import { isoDate } from '@/lib/search'
import { MemberDayPage } from '@/features/team/pages/MemberDayPage'

// An activador's day, read-only, for their supervisor (under Hoy in the navigation).
export const Route = createFileRoute('/_app/s/today_/$personId')({
  validateSearch: (search: Record<string, unknown>): { date?: string } => ({ date: isoDate(search.date) }),
  component: function MemberDay() {
    return <MemberDayPage personId={Route.useParams().personId} date={Route.useSearch().date} />
  },
})
