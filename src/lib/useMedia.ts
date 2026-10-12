import { useSyncExternalStore } from 'react'

const DESKTOP = '(min-width: 1024px)'

/** Whether the desktop layout is showing (same breakpoint as the styles' `up(lg)`). */
export function useIsDesktop() {
  return useSyncExternalStore(
    (listener) => {
      const mq = window.matchMedia(DESKTOP)
      mq.addEventListener('change', listener)
      return () => mq.removeEventListener('change', listener)
    },
    () => window.matchMedia(DESKTOP).matches,
  )
}
