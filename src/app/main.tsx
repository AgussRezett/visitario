import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { applyTheme } from '@/features/profile/theme'
import { FullScreenSpinner } from '@/ui/Spinner'
import { routeTree } from './routeTree.gen'
import '@/styles/index.css'

applyTheme()
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme())

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPendingComponent: () => <FullScreenSpinner />,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Any sign-in, sign-out or token refresh refreshes who "me" is and re-runs route guards.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
    void queryClient.invalidateQueries({ queryKey: ['me'] }).then(() => router.invalidate())
  }
})

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Missing #root element')

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
