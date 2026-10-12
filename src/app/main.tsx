// Global styles first: they declare the cascade layer order (reset < base < ui).
import '@/styles/main.scss'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { refreshMe } from '@/features/auth/me'
import { applyTheme } from '@/features/profile/theme'
import { FullScreenSpinner } from '@/ui/Spinner'
import { PERSIST_OPTIONS } from '@/features/sync/persist'
import { startSync } from '@/features/sync/outbox'
import { startPwa } from './pwa'
import { routeTree } from './routeTree.gen'

applyTheme()
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme())

// Data counts as fresh for 30 s: going back to a screen shows it at once without refetching.
// Every change invalidates what it touches, so edits still show right away. Screens are kept
// for a day (and saved on the phone) so the app opens and works without signal.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000, gcTime: 24 * 60 * 60_000 } },
})

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
  // Route options read by the app shell.
  interface StaticDataRouteOption {
    /** Hide the phone header and bottom navigation (the page brings its own bars). */
    immersive?: boolean
  }
}

// Any sign-in, sign-out or user change refreshes who "me" is and re-runs route guards.
// Deferred with setTimeout: Supabase holds its auth lock while running this callback, so
// calling Supabase from inside it (fetching "me") would wait forever and freeze sign-in.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') queryClient.clear()
  if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
    setTimeout(() => {
      void refreshMe(queryClient)
        .catch(() => null)
        .then(() => router.invalidate())
    }, 0)
  }
})

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Missing #root element')

// Restore the saved screens before the first route guard runs: without signal the guard
// would otherwise wait for the network forever.
async function start(root: HTMLElement) {
  const [, restored] = persistQueryClient({ queryClient, ...PERSIST_OPTIONS })
  await restored.catch(() => null)
  void startSync(queryClient)
  startPwa()
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}
void start(rootElement)
