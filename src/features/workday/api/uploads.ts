import { useSyncExternalStore } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { supabase, type Enums } from '@/lib/supabase'
import type { Photo, Visit } from './queries'
import { workdayKeys } from './queries'

/**
 * Photos go up in the background: the merchandiser sees the photo at once and keeps
 * working while it uploads. Failed uploads retry by themselves (and when the phone gets
 * signal back); only a photo the server rejects stays failed for a manual retry.
 * The queue lives in memory: leaving the app with uploads pending asks for confirmation.
 */

export type UploadState = 'uploading' | 'failed'

export interface PendingUpload {
  photo: Photo
  visitId: string
  state: UploadState
  blob: Blob
  width: number
  height: number
  sortOrder: number
  /** Resolves true once the server has the photo, false if it gave up. */
  done: Promise<boolean>
}

const RETRY_DELAYS_MS = [1_000, 3_000, 8_000, 20_000]

let uploads: PendingUpload[] = []
const listeners = new Set<() => void>()
const settle = new Map<string, (ok: boolean) => void>()

function set(next: PendingUpload[]) {
  uploads = next
  listeners.forEach((l) => l())
}
const patch = (id: string, change: Partial<PendingUpload>) => set(uploads.map((u) => (u.photo.id === id ? { ...u, ...change } : u)))
const remove = (id: string) => set(uploads.filter((u) => u.photo.id !== id))

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export const usePendingUploads = () => useSyncExternalStore(subscribe, () => uploads)
export const pendingUpload = (id: string) => uploads.find((u) => u.photo.id === id)

class PermanentError extends Error {}

async function send(u: PendingUpload) {
  const form = new FormData()
  form.append('file', u.blob, `${u.photo.id}.jpg`)
  form.append(
    'meta',
    JSON.stringify({ id: u.photo.id, visitId: u.visitId, displayId: u.photo.displayId, kind: u.photo.kind, takenAt: u.photo.takenAt, width: u.width, height: u.height, sortOrder: u.sortOrder }),
  )
  const { error } = await supabase.functions.invoke('photos', { body: form })
  if (!error) return
  const status = (error as { context?: { status?: number } }).context?.status ?? 0
  // 4xx (except auth and rate limits) will not change by retrying: the server refused this photo.
  if (status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429) throw new PermanentError(String(status))
  throw error
}

const waitForSignal = () =>
  navigator.onLine ? Promise.resolve() : new Promise<void>((resolve) => window.addEventListener('online', () => resolve(), { once: true }))
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function run(qc: QueryClient, id: string) {
  for (let attempt = 0; ; attempt++) {
    const u = pendingUpload(id)
    if (!u) return // deleted while waiting
    await waitForSignal()
    try {
      await send(u)
      break
    } catch (e) {
      if (e instanceof PermanentError || attempt >= RETRY_DELAYS_MS.length) {
        patch(id, { state: 'failed' })
        settle.get(id)?.(false)
        return
      }
      await sleep(RETRY_DELAYS_MS[attempt] ?? 0)
    }
  }
  // Keep showing the local copy until the refreshed visit includes the photo.
  await qc.invalidateQueries({ queryKey: workdayKeys.all })
  remove(id)
  settle.get(id)?.(true)
  settle.delete(id)
}

export interface QueuedPhoto {
  id: string
  visitId: string
  displayId: string | null
  kind: Enums<'photo_kind'>
  blob: Blob
  width: number
  height: number
  sortOrder?: number
}

/** Adds a compressed photo to the queue and returns at once. */
export function enqueuePhoto(qc: QueryClient, p: QueuedPhoto) {
  const id = p.id
  const done = new Promise<boolean>((resolve) => settle.set(id, resolve))
  const photo: Photo = { id, kind: p.kind, displayId: p.displayId, takenAt: new Date().toISOString(), uploaded: false }
  set([...uploads, { photo, visitId: p.visitId, state: 'uploading', blob: p.blob, width: p.width, height: p.height, sortOrder: p.sortOrder ?? 0, done }])
  void run(qc, id)
  return { id, done }
}

/** Tries a failed upload again. */
export function retryUpload(qc: QueryClient, id: string) {
  const u = pendingUpload(id)
  if (!u || u.state !== 'failed') return
  patch(id, { state: 'uploading', done: new Promise<boolean>((resolve) => settle.set(id, resolve)) })
  void run(qc, id)
}

/** Drops a photo that never reached the server. Returns false if it is already on its way. */
export function discardUpload(id: string) {
  const u = pendingUpload(id)
  if (!u || u.state !== 'failed') return false
  remove(id)
  settle.get(id)?.(false)
  settle.delete(id)
  return true
}

/** Waits for the visit's photos; false if any of them could not be uploaded. */
export async function uploadsSettled(visitId: string) {
  const results = await Promise.all(uploads.filter((u) => u.visitId === visitId).map((u) => u.done))
  return results.every(Boolean)
}

/**
 * The visit as the merchandiser sees it: with the photos still uploading, and started
 * as soon as the storefront photo is taken (the database confirms it after the upload).
 */
export function withPendingUploads(v: Visit, pending: PendingUpload[]): Visit {
  const mine = pending.filter((u) => u.visitId === v.id && !v.photos.some((p) => p.id === u.photo.id))
  if (!mine.length) return v
  const storefront = mine.find((u) => u.photo.kind === 'storefront')
  const started = v.workStatus === 'pending' && storefront
  return {
    ...v,
    photos: [...v.photos, ...mine.map((u) => u.photo)],
    ...(started ? { workStatus: 'in_progress' as const, arrivedAt: storefront.photo.takenAt } : {}),
  }
}

export const uploadStateOf = (id: string, pending: PendingUpload[]) => pending.find((u) => u.photo.id === id)?.state

// Closing the app would lose the photos still in memory.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (uploads.length) e.preventDefault()
  })
}
