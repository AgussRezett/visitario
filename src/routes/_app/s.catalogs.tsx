import { createFileRoute } from '@tanstack/react-router'
import { CatalogsPage } from '@/features/admin/pages/CatalogsPage'

export const Route = createFileRoute('/_app/s/catalogs')({
  component: CatalogsPage,
})
