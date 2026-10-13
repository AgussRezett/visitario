import { createFileRoute } from '@tanstack/react-router'
import { DirectoryPage } from '@/features/stores/pages/DirectoryPage'

export const Route = createFileRoute('/_app/s/stores')({
  component: DirectoryPage,
})
