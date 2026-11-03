import { Outlet, createRootRouteWithContext, useRouterState } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { useBaseTitle } from '@/lib/useDocumentTitle'
import { titleFor } from '@/features/shell/titles'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: function Root() {
    // Every tab says what it shows, even before signing in.
    useBaseTitle(titleFor(useRouterState({ select: (r) => r.location.pathname })), 'root')
    return <Outlet />
  },
})
