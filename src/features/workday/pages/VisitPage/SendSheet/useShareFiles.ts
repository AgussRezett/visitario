import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Crop } from '@/domain/crop'
import { croppedBlob } from '@/features/workday/api/crop-file'
import { localPhotoBlob, photoFile } from '@/features/workday/api/photos'

type Entry = Blob | 'error'

/** How long to wait for a photo before offering to retry (no signal, for example). */
const GIVE_UP_MS = 10_000
/** A photo that failed is tried again by itself a few times (its upload may be finishing). */
const AUTO_RETRY_MS = 3_000
const AUTO_RETRIES = 3

/**
 * The photos' bytes, loaded before the person taps: the phone only opens the share sheet
 * right after a tap, so there is no time to download them then. Photos still on the phone
 * are used as they are; the others come through the photos function (photoFile).
 *
 * What kept every photo taken earlier on "Reintentar": they were read from their signed link,
 * and the bucket has no CORS, so the browser can show those links but never read them. Only
 * photos still on the phone could be sent. Now the bytes come through the function, which
 * the browser can read, with the same permissions.
 *
 * A cropped photo goes cropped; changing the crop prepares it again.
 */
export function useShareFiles(ids: readonly string[], urlFor: (id: string) => string | undefined, active: boolean, cropFor: (id: string) => Crop | null = () => null) {
  const qc = useQueryClient()
  const [files, setFiles] = useState<Record<string, Entry>>({})
  const [attempt, setAttempt] = useState(0)
  const current = useRef(files)
  current.current = files
  /** What was already asked for each photo in this attempt: its link, or "local". */
  const asked = useRef(new Map<string, string>())
  const autoRetries = useRef(0)
  /** The crop each prepared file has. */
  const made = useRef(new Map<string, string>())
  const urls = ids.map((id) => urlFor(id) ?? '')
  const crops = ids.map((id) => JSON.stringify(cropFor(id)))
  const signature = ids.map((id, i) => `${id}=${urls[i]}=${crops[i]}`).join('|')

  useEffect(() => {
    if (!active) return
    let alive = true
    const set = (id: string, entry: Entry) => alive && setFiles((m) => (m[id] instanceof Blob && entry === 'error' ? m : { ...m, [id]: entry }))
    const ready = (id: string, blob: Blob, crop: string) =>
      croppedBlob(blob, cropFor(id)).then((b) => {
        made.current.set(id, crop)
        set(id, b)
      }, () => set(id, 'error'))
    ids.forEach((id, i) => {
      const crop = crops[i] ?? 'null'
      if (current.current[id] instanceof Blob && made.current.get(id) === crop) return
      const local = localPhotoBlob(id)
      if (local) {
        void ready(id, local, crop)
        return
      }
      // Uploaded (it has a link) and not on the phone: its bytes through the function.
      const key = `${attempt}|${crop}`
      if (!urls[i] || asked.current.get(id) === key) return
      asked.current.set(id, key)
      photoFile(id).then((blob) => ready(id, blob, crop), () => set(id, 'error'))
    })
    const timer = setTimeout(() => {
      if (!alive) return
      setFiles((m) => {
        const late = ids.filter((id) => !(id in m) && !asked.current.has(id))
        return late.length ? { ...m, ...Object.fromEntries(late.map((id) => [id, 'error' as const])) } : m
      })
    }, GIVE_UP_MS)
    return () => {
      alive = false
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ids and urls are compared by their signature
  }, [active, signature, attempt])

  const retry = useCallback(() => {
    setFiles((m) => Object.fromEntries(Object.entries(m).filter(([, e]) => e !== 'error')))
    asked.current.clear()
    // Fresh links: an expired one never comes back to life.
    void qc.invalidateQueries({ queryKey: ['photo-urls'] })
    setAttempt((a) => a + 1)
  }, [qc])

  // A failed photo is tried again by itself, a few times, while the sheet is open.
  const failed = active && Object.values(files).some((e) => e === 'error')
  useEffect(() => {
    if (!failed || autoRetries.current >= AUTO_RETRIES) return
    const t = setTimeout(() => {
      autoRetries.current += 1
      retry()
    }, AUTO_RETRY_MS)
    return () => clearTimeout(t)
  }, [failed, retry])
  useEffect(() => {
    if (!active) autoRetries.current = 0
  }, [active])

  return { files, retry }
}

export type SendState = 'missing' | 'loading' | 'error' | 'ready'

export function sendState(photoIds: readonly string[], files: Record<string, Entry>): SendState {
  if (!photoIds.length) return 'missing'
  if (photoIds.some((id) => files[id] === 'error')) return 'error'
  return photoIds.every((id) => files[id] instanceof Blob) ? 'ready' : 'loading'
}
