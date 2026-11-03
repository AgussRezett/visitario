import { useEffect, useState } from 'react'
import { turnFor, type Turn } from './frame'

export const isIOS = () =>
  typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

type MotionPermission = { requestPermission?: () => Promise<string> }

/** iPhone asks once to read the phone's tilt; it only asks from inside a tap. */
export function askMotion() {
  const D = (globalThis as { DeviceMotionEvent?: MotionPermission }).DeviceMotionEvent
  if (typeof D?.requestPermission === 'function') void D.requestPermission().catch(() => null)
}

/** How to turn the picture for the way the phone is held right now (see turnFor). */
export function useTurn(): Turn {
  const [turn, setTurn] = useState<Turn>(0)
  useEffect(() => {
    const ios = isIOS()
    const on = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity
      if (g?.x == null || g.y == null) return
      const angle = typeof screen !== 'undefined' ? screen.orientation?.angle ?? 0 : 0
      setTurn(turnFor({ x: g.x, y: g.y }, ios, angle))
    }
    window.addEventListener('devicemotion', on)
    return () => window.removeEventListener('devicemotion', on)
  }, [])
  return turn
}
