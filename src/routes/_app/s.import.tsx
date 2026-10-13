import { createFileRoute } from '@tanstack/react-router'
import { isoDate, uuid } from '@/lib/search'
import { ImportPage, type ImportSearch } from '@/features/import/pages/ImportPage'

// Full-screen on phones: its own top bar and the step's actions at the bottom.
export const Route = createFileRoute('/_app/s/import')({
  staticData: { immersive: true },
  validateSearch: (search: Record<string, unknown>): ImportSearch => ({ date: isoDate(search.date), person: uuid(search.person) }),
  component: function Import() {
    return <ImportPage {...Route.useSearch()} />
  },
})
