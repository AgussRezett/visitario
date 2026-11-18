import { useSyncExternalStore } from 'react'

const QUERY = '(min-width: 1024px)' // the `lg` breakpoint in src/styles/abstracts/_breakpoints.scss

/** Whether the screen is a computer's (the sidebar layout); follows the window as it changes. */
export function useWide(): boolean {
  return useSyncExternalStore(
    (change) => {
      const media = window.matchMedia(QUERY)
      media.addEventListener('change', change)
      return () => media.removeEventListener('change', change)
    },
    () => window.matchMedia(QUERY).matches,
    () => true,
  )
}
