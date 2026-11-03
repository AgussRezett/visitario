import { createFileRoute } from '@tanstack/react-router'
import { ReportsHub, type ReportsSearch } from '@/features/team/pages/ReportsPage/ReportsHub'
import { PERIOD_LABEL, type PeriodPreset } from '@/domain/report-period'

const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined)

export const Route = createFileRoute('/_app/s/reports')({
  validateSearch: (search: Record<string, unknown>): ReportsSearch => ({
    view: search.view === 'daily' ? 'daily' : undefined,
    period: typeof search.period === 'string' && search.period in PERIOD_LABEL ? (search.period as PeriodPreset) : undefined,
    from: day(search.from),
    to: day(search.to),
    compare: search.compare === false || search.compare === 'false' ? false : undefined,
    // A date alone (from an older link) opens that day's reports.
    date: day(search.date),
  }),
  component: function Reports() {
    const search = Route.useSearch()
    return <ReportsHub search={search.date && !search.view ? { ...search, view: 'daily' } : search} />
  },
})
