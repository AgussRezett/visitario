import { createFileRoute } from '@tanstack/react-router'
import { DirectoryPage } from '@/features/stores/pages/DirectoryPage'
import { ReputationPage } from '@/features/reputation/pages/ReputationPage'

export const Route = createFileRoute('/_app/s/stores')({
  validateSearch: (search: Record<string, unknown>): { view?: 'reputation'; days?: 30 | 90 } => ({
    view: search.view === 'reputation' ? 'reputation' : undefined,
    days: search.days === 30 || search.days === '30' ? 30 : search.days === 90 || search.days === '90' ? 90 : undefined,
  }),
  component: function Stores() {
    const { view, days } = Route.useSearch()
    return view === 'reputation' ? <ReputationPage days={days ?? 90} /> : <DirectoryPage />
  },
})
