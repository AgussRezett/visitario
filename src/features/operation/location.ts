import { useEffect, useSyncExternalStore } from 'react'
import { announceLocation } from './presence'

/**
 * Sharing my location with the operativo: a choice per operativo on this phone (it asks the
 * browser's permission the first time). The position only travels in the presence, every
 * 20 seconds at most, and stops when sharing stops or the app closes. It is never stored.
 */

const key = (operationId: string) => `visitario.operation.share.${operationId}`
const listeners = new Set<() => void>()

export function isSharing(operationId: string) {
  try {
    return localStorage.getItem(key(operationId)) === '1'
  } catch {
    return false
  }
}

export function setSharing(operationId: string, on: boolean) {
  try {
    if (on) localStorage.setItem(key(operationId), '1')
    else localStorage.removeItem(key(operationId))
  } catch {
    // Without storage the choice lasts while the app is open.
  }
  memory.set(operationId, on)
  listeners.forEach((l) => l())
}

const memory = new Map<string, boolean>()
const read = (operationId: string) => memory.get(operationId) ?? isSharing(operationId)
let lastError: string | null = null
const setError = (e: string | null) => {
  if (e === lastError) return
  lastError = e
  listeners.forEach((l) => l())
}

/** Why the phone does not give its position (shown next to the switch). */
export function useLocationError() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => lastError,
  )
}

export function useSharing(operationId: string | null) {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => (operationId ? read(operationId) : false),
  )
}

const EVERY_MS = 20_000

/** Watches the position while sharing (mounted once, in the app shell); says when the phone refuses it. */
export function useShareLocation(operationId: string | null) {
  const on = useSharing(operationId)
  useEffect(() => {
    if (!operationId || !on) return
    if (!('geolocation' in navigator)) {
      setError('Este celular no comparte su ubicación.')
      return
    }
    setError(null)
    let last = 0
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (Date.now() - last < EVERY_MS) return
        last = Date.now()
        announceLocation(operationId, { lat: p.coords.latitude, lng: p.coords.longitude })
      },
      (e) => setError(e.code === e.PERMISSION_DENIED ? 'Tu celular no dio permiso de ubicación. Activalo en los ajustes del navegador.' : 'No pudimos ver tu ubicación.'),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 },
    )
    return () => {
      navigator.geolocation.clearWatch(id)
      announceLocation(operationId, null)
    }
  }, [operationId, on])
}
