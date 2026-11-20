import { useEffect, useSyncExternalStore } from 'react'
import { shouldSend, type Fix } from '@/domain/tracking'
import { readLocal, writeLocal } from '@/lib/storage'
import { sharePosition } from './api'

/**
 * The activador's phone sharing where it is during the workday. Mounted once (in the shell),
 * it watches the position while the day is under way and sends it now and then; the screens
 * read how it is going to say so.
 */
export type SharingState = 'off' | 'sharing' | 'denied' | 'unavailable'

let state: SharingState = 'off'
const listeners = new Set<() => void>()
const set = (s: SharingState) => {
  if (s === state) return
  state = s
  listeners.forEach((l) => l())
}

export function useSharingState(): SharingState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

/** Which phone this is, so two phones of the same person are told apart. */
function deviceId(): string {
  const saved = readLocal('visitario.deviceId')
  if (saved) return saved
  const id = crypto.randomUUID()
  writeLocal('visitario.deviceId', id)
  return id
}

export function useShareDay(workdayId: string | null) {
  useEffect(() => {
    if (!workdayId) {
      set('off')
      return
    }
    if (!('geolocation' in navigator)) {
      set('unavailable')
      return
    }
    const device = deviceId()
    let last: Fix | null = null
    let sending = false
    const options: PositionOptions = { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 }
    const onPosition = (p: GeolocationPosition) => {
      set('sharing')
      const next: Fix = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() }
      if (sending || !navigator.onLine || !shouldSend(last, next)) return
      sending = true
      sharePosition(workdayId, device, next)
        .then(() => { last = next })
        .catch(() => null) // without signal or after the day: the next one tries again
        .finally(() => { sending = false })
    }
    const onError = (e: GeolocationPositionError) => set(e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable')
    const watch = navigator.geolocation.watchPosition(onPosition, onError, options)
    // Back in the app after a trip with it closed: where they are now, at once.
    const back = () => {
      if (document.visibilityState === 'visible') navigator.geolocation.getCurrentPosition(onPosition, onError, options)
    }
    document.addEventListener('visibilitychange', back)
    return () => {
      navigator.geolocation.clearWatch(watch)
      document.removeEventListener('visibilitychange', back)
      set('off')
    }
  }, [workdayId])
}
