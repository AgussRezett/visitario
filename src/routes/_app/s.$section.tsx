import { createFileRoute, notFound } from '@tanstack/react-router'
import { findSection } from '@/features/shell/sections'
import { ComingSoonPage } from '@/features/shell/pages/ComingSoonPage'

export const Route = createFileRoute('/_app/s/$section')({
  loader: ({ params }) => {
    const section = findSection(params.section)
    if (!section) throw notFound()
    return section
  },
  component: function SectionPage() {
    return <ComingSoonPage section={Route.useLoaderData()} />
  },
})
