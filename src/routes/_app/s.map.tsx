import { createFileRoute } from '@tanstack/react-router'
import { StoreMapPage } from '@/features/storemap/pages/StoreMapPage'

// The points of sale on a map (supervisors, admins and sellers). ?point opens one.
export const Route = createFileRoute('/_app/s/map')({
  validateSearch: (search: Record<string, unknown>): { point?: string } => ({ point: typeof search.point === 'string' ? search.point : undefined }),
  component: function StoreMap() {
    return <StoreMapPage point={Route.useSearch().point} />
  },
})
