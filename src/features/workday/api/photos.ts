import { useState } from 'react'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { fitWithin, PHOTO_MAX_SIDE, PHOTO_QUALITY } from '@/domain/image'
import { getSync } from '@/features/sync/outbox'

/**
 * Photos still on the phone (taken now, or waiting in the outbox since an earlier session),
 * shown and shared from their own bytes without waiting for a signed URL.
 */
const localPhotos = new Map<string, { blob: Blob; url: string }>()
/** Kept in memory for the photos of the visit at hand; older ones go back to their link. */
const KEEP_LOCAL = 24
function local(id: string) {
  let entry = localPhotos.get(id)
  if (entry) {
    // Most recently used last.
    localPhotos.delete(id)
    localPhotos.set(id, entry)
    return entry
  }
  const blob = getSync().rows.find((r) => r.id === id)?.blob
  if (!blob) return undefined
  entry = { blob, url: URL.createObjectURL(blob) }
  localPhotos.set(id, entry)
  for (const [old, e] of localPhotos) {
    if (localPhotos.size <= KEEP_LOCAL) break
    // Still waiting to upload: it stays, it has no link yet.
    if (getSync().rows.some((r) => r.id === old)) continue
    URL.revokeObjectURL(e.url)
    localPhotos.delete(old)
  }
  return entry
}
export const localPhotoUrl = (id: string) => local(id)?.url
export const localPhotoBlob = (id: string) => local(id)?.blob

/**
 * Opens a picture the way it was taken: an <img> applies the camera's orientation (a photo
 * taken sideways stays sideways) on every browser; createImageBitmap only as a fallback.
 */
async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) }
  } catch {
    URL.revokeObjectURL(url)
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() }
  }
}

/** Pictures already at the kept size and quality (Visitario's camera): nothing to redo. */
const ready = new WeakMap<Blob, { width: number; height: number }>()
export const markReady = (photo: Blob, width: number, height: number) => ready.set(photo, { width, height })

/**
 * Resizes to 1400 px and re-encodes as JPEG 72 % (other sizes for captures to read).
 * Drawing to a canvas drops all EXIF metadata, so no location ever leaves the phone.
 * The canvas is emptied right after: iPhone keeps a small budget for canvases, and photo
 * after photo it ran out (the camera took seconds to show each picture until a restart).
 */
export async function compressPhoto(file: Blob, maxSide = PHOTO_MAX_SIDE, quality = PHOTO_QUALITY) {
  const done = ready.get(file)
  if (done && maxSide === PHOTO_MAX_SIDE && quality === PHOTO_QUALITY) return { blob: file, ...done }
  const image = await decode(file)
  const size = fitWithin(image.width, image.height, maxSide)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  try {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not available')
    ctx.drawImage(image.source, 0, 0, size.width, size.height)
    image.done()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) throw new Error('Could not encode the photo')
    return { blob, ...size }
  } finally {
    canvas.width = 0
    canvas.height = 0
  }
}

export class PhotoError extends Error {}

/** Compresses a photo on the phone (a fraction of a second); the caller queues it. */
export function usePreparePhoto() {
  const [preparing, setPreparing] = useState(0)
  const prepare = async (file: Blob) => {
    setPreparing((n) => n + 1)
    try {
      return await compressPhoto(file).catch(() => {
        throw new PhotoError('No pudimos leer la foto. Probá sacarla de nuevo.')
      })
    } finally {
      setPreparing((n) => n - 1)
    }
  }
  return { prepare, preparing: preparing > 0 }
}

const photoUrlsQuery = (ids: string[]) =>
  queryOptions({
    queryKey: ['photo-urls', ...ids] as const,
    enabled: ids.length > 0,
    staleTime: 45 * 60_000, // signed for 1 h
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<{ urls: Record<string, string> }>('photos/urls', { body: { ids } })
      // Thrown, not an empty answer: an empty one stayed 45 minutes and the photos had no link.
      if (error) throw error
      return data?.urls ?? {}
    },
  })

/** URL to show each photo: the in-memory copy if taken now, else a signed one. */
export function usePhotoUrls(ids: string[]) {
  const remote = ids.filter((id) => !local(id)).sort()
  const { data } = useQuery(photoUrlsQuery(remote))
  return (id: string) => localPhotoUrl(id) ?? data?.[id]
}
