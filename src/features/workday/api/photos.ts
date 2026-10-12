import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, type Enums } from '@/lib/supabase'
import { uuidv7 } from '@/lib/id'
import { fitWithin, PHOTO_QUALITY } from '@/domain/image'
import { workdayKeys } from './queries'

/**
 * Photos taken in this session, kept in memory to show and share them right away
 * without waiting for a signed URL. Never persisted.
 */
const localPhotos = new Map<string, { blob: Blob; url: string }>()
export const localPhotoUrl = (id: string) => localPhotos.get(id)?.url
export const localPhotoBlob = (id: string) => localPhotos.get(id)?.blob

/**
 * Resizes to 1400 px and re-encodes as JPEG 72 %. Drawing to a canvas drops all
 * EXIF metadata, so no location ever leaves the phone.
 */
export async function compressPhoto(file: Blob) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const size = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  ctx.drawImage(bitmap, 0, 0, size.width, size.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY))
  if (!blob) throw new Error('Could not encode the photo')
  return { blob, ...size }
}

export interface NewPhoto {
  visitId: string
  displayId: string | null
  kind: Enums<'photo_kind'>
  file: Blob
  sortOrder?: number
}

export class PhotoError extends Error {}

export function useUploadPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: NewPhoto) => {
      const { blob, width, height } = await compressPhoto(p.file)
      const id = uuidv7()
      localPhotos.set(id, { blob, url: URL.createObjectURL(blob) })
      const form = new FormData()
      form.append('file', blob, `${id}.jpg`)
      form.append(
        'meta',
        JSON.stringify({ id, visitId: p.visitId, displayId: p.displayId, kind: p.kind, takenAt: new Date().toISOString(), width, height, sortOrder: p.sortOrder ?? 0 }),
      )
      const { error } = await supabase.functions.invoke('photos', { body: form })
      if (error) {
        localPhotos.delete(id)
        throw new PhotoError('No pudimos subir la foto. Revisá la conexión y probá de nuevo.')
      }
      return { id, bytes: blob.size }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: workdayKeys.all }),
  })
}

export function useDeletePhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('photo').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw new PhotoError('No pudimos borrar la foto.')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: workdayKeys.all }),
  })
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
  const remote = ids.filter((id) => !localPhotos.has(id)).sort()
  const { data } = useQuery(photoUrlsQuery(remote))
  return (id: string) => localPhotoUrl(id) ?? data?.[id]
}
