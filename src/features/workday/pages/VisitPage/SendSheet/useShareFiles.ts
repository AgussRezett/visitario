import { useCallback, useEffect, useRef, useState } from 'react'
import { localPhotoBlob } from '@/features/workday/api/photos'

type Entry = Blob | 'error'

/** How long to wait for a photo's link before offering to retry (no signal, for example). */
const GIVE_UP_MS = 10_000

/**
 * The photos' bytes, loaded before the person taps: the phone only opens the share sheet
 * right after a tap, so there is no time to download them then. Photos still on the phone
 * are used as they are; the others are downloaded once through their signed link.
 */
export function useShareFiles(ids: readonly string[], urlFor: (id: string) => string | undefined, active: boolean) {
  const [files, setFiles] = useState<Record<string, Entry>>({})
  const [attempt, setAttempt] = useState(0)
  const requested = useRef(new Set<string>())
  const urls = ids.map((id) => urlFor(id) ?? '')
  const signature = ids.map((id, i) => `${id}=${urls[i]}`).join('|')

  useEffect(() => {
    if (!active) return
    let alive = true
    const set = (id: string, entry: Entry) => alive && setFiles((m) => ({ ...m, [id]: entry }))
    ids.forEach((id, i) => {
      if (requested.current.has(id)) return
      const local = localPhotoBlob(id)
      if (local) {
        requested.current.add(id)
        set(id, local)
        return
      }
      const url = urls[i]
      if (!url) return
      requested.current.add(id)
      fetch(url)
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
        .then((blob) => set(id, blob), () => set(id, 'error'))
    })
    const timer = setTimeout(() => {
      if (alive) setFiles((m) => Object.fromEntries([...Object.entries(m), ...ids.filter((id) => !(id in m) && !requested.current.has(id)).map((id) => [id, 'error' as const])]))
    }, GIVE_UP_MS)
    return () => {
      alive = false
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ids and urls are compared by their signature
  }, [active, signature, attempt])

  const retry = useCallback(() => {
    setFiles((m) => {
      const keep = Object.entries(m).filter(([id, e]) => {
        if (e !== 'error') return true
        requested.current.delete(id)
        return false
      })
      return Object.fromEntries(keep)
    })
    setAttempt((a) => a + 1)
  }, [])

  return { files, retry }
}

export type SendState = 'missing' | 'loading' | 'error' | 'ready'

export function sendState(photoIds: readonly string[], files: Record<string, Entry>): SendState {
  if (!photoIds.length) return 'missing'
  if (photoIds.some((id) => files[id] === 'error')) return 'error'
  return photoIds.every((id) => files[id] instanceof Blob) ? 'ready' : 'loading'
}
