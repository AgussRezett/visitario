import { useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'

/**
 * New versions: the service worker downloads them in the background and waits. The app
 * shows "Hay una versión nueva" and reloads only when the person taps "Actualizar", so a
 * deploy never interrupts an activation. It also checks for updates every 30 minutes and
 * whenever the app comes back to the foreground (installed apps stay open for days).
 */

const CHECK_EVERY_MS = 30 * 60_000

let needRefresh = false
let update: ((reload?: boolean) => Promise<void>) | null = null
const listeners = new Set<() => void>()

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useUpdateReady = () => useSyncExternalStore(subscribe, () => needRefresh)

/**
 * Activates the waiting version, which reloads the page once it takes control. A page the
 * old version never controlled (the very first visit) gets no such signal: reload anyway.
 */
export function applyUpdate() {
  if (update) void update(true)
  setTimeout(() => window.location.reload(), update ? 2_000 : 0)
}

export function startPwa() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  update = registerSW({
    onNeedRefresh() {
      needRefresh = true
      listeners.forEach((l) => l())
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (navigator.onLine && !registration.installing) void registration.update().catch(() => null)
      }
      setInterval(check, CHECK_EVERY_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    },
  })
}
