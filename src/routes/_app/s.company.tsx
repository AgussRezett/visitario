import { createFileRoute } from '@tanstack/react-router'
import { CompanyPage } from '@/features/admin/pages/CompanyPage'

export const Route = createFileRoute('/_app/s/company')({
  component: CompanyPage,
})
