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
function local(id: string) {
  let entry = localPhotos.get(id)
  if (!entry) {
    const blob = getSync().rows.find((r) => r.id === id)?.blob
    if (blob) {
      entry = { blob, url: URL.createObjectURL(blob) }
      localPhotos.set(id, entry)
    }
  }
  return entry
}
export const localPhotoUrl = (id: string) => local(id)?.url
export const localPhotoBlob = (id: string) => local(id)?.blob

/**
 * Resizes to 1400 px and re-encodes as JPEG 72 % (other sizes for captures to read).
 * Drawing to a canvas drops all EXIF metadata, so no location ever leaves the phone.
 */
export async function compressPhoto(file: Blob, maxSide = PHOTO_MAX_SIDE, quality = PHOTO_QUALITY) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const size = fitWithin(bitmap.width, bitmap.height, maxSide)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  ctx.drawImage(bitmap, 0, 0, size.width, size.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('Could not encode the photo')
  return { blob, ...size }
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
      if (error) return {}
      return data?.urls ?? {}
    },
  })

/** URL to show each photo: the in-memory copy if taken now, else a signed one. */
export function usePhotoUrls(ids: string[]) {
  const remote = ids.filter((id) => !local(id)).sort()
  const { data } = useQuery(photoUrlsQuery(remote))
  return (id: string) => localPhotoUrl(id) ?? data?.[id]
}
