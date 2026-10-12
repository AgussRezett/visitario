import { useSyncExternalStore } from 'react'

const subscribe = (listener: () => void) => {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

/** Whether the phone says it has a connection (it can still be a weak one). */
export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine)
