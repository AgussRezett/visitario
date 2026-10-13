import { createFileRoute } from '@tanstack/react-router'
import { TemplatesPage } from '@/features/admin/pages/TemplatesPage'

export const Route = createFileRoute('/_app/s/templates')({
  component: TemplatesPage,
})
