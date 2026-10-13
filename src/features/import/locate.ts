import { useEffect, useRef, useState } from 'react'
import { geocode, type GeocodeResult } from '@/features/workday/api/geocode'

/** null: looked up, nothing exact enough found. */
export type Located = GeocodeResult | null

/**
 * Locates new stores one at a time (the geocoder allows about two requests a second), so a
 * long spreadsheet fills in progressively. A failed one can be tried again.
 */
export function useLocate(addresses: string[], scope: 'caba' | 'argentina') {
  const [found, setFound] = useState<Record<string, Located>>({})
  const busy = useRef(false)
  const key = (a: string) => `${scope}|${a.trim().toLowerCase()}`
  const missing = addresses.filter((a) => a.trim().length >= 4 && !(key(a) in found))
  const next = missing[0]

  useEffect(() => {
    if (!next || busy.current) return
    busy.current = true
    let alive = true
    const started = Date.now()
    void geocode(next, scope)
      .then((results) => results[0] ?? null)
      .catch(() => null)
      .then(async (result) => {
        await new Promise((r) => setTimeout(r, Math.max(0, 550 - (Date.now() - started))))
        busy.current = false
        if (alive) setFound((f) => ({ ...f, [key(next)]: result }))
      })
    return () => {
      alive = false
      busy.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one lookup at a time, driven by the next missing address
  }, [next, scope])

  return {
    get: (address: string): Located | undefined => found[key(address)],
    pending: missing.length,
    retry: (address: string) =>
      setFound((f) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== key(address)))),
  }
}
