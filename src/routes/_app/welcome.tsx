import { createFileRoute } from '@tanstack/react-router'
import { NoMembership } from '@/features/shell/NoMembership'

export const Route = createFileRoute('/_app/welcome')({ component: NoMembership })
