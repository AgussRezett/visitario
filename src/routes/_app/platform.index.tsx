import { createFileRoute } from '@tanstack/react-router'
import { PlatformPage } from '@/features/platform/pages/PlatformPage'

export const Route = createFileRoute('/_app/platform/')({
  component: PlatformPage,
})
