import { createFileRoute } from '@tanstack/react-router'
import { SupportPage } from '@/features/platform/pages/SupportPage'

export const Route = createFileRoute('/_app/platform/$companyId')({
  component: function Support() {
    const { companyId } = Route.useParams()
    return <SupportPage companyId={companyId} />
  },
})
