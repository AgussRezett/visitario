import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { argentinaTime } from '@/domain/dates'
import { finishStatus, type Consent } from '@/domain/visit'
import type { Visit } from '@/features/workday/api/queries'
import { useUpdateVisit } from '@/features/workday/api/mutations'
import { PhotoError, useAddPhoto, useDeletePhoto, type NewPhoto } from '@/features/workday/api/photos'
import { retryUpload, uploadsSettled } from '@/features/workday/api/uploads'

/** Everything the visit sheet can do, in the order the merchandiser does it. */
export function useVisitActions(visit: Visit) {
  const qc = useQueryClient()
  const update = useUpdateVisit(visit.id)
  const photos = useAddPhoto()
  const remove = useDeletePhoto()
  const [photoError, setPhotoError] = useState<Error | null>(null)

  /** Photos never block: they show at once and upload in the background. */
  const add = async (p: NewPhoto) => {
    setPhotoError(null)
    try {
      return await photos.add(p)
    } catch (e) {
      setPhotoError(e instanceof Error ? e : new PhotoError('No pudimos agregar la foto.'))
      return null
    }
  }

  /** Arrival = storefront photo. The visit shows as started right away; the database
   *  confirms it after the upload, and sends it back to pending if the photo is deleted. */
  const arrive = async (file: File) => {
    await add({ visitId: visit.id, displayId: null, kind: 'storefront', file })
  }

  const photo = async (displayId: string, kind: 'before' | 'after', file: File) => {
    await add({ visitId: visit.id, displayId, kind, file, sortOrder: visit.photos.filter((p) => p.displayId === displayId && p.kind === kind).length })
  }

  const setConsent = (consent: Consent) =>
    update.mutateAsync({
      consent,
      objection: consent === 'with_objection' ? visit.objection : null,
      retry_after: consent === 'closed' ? visit.retryAfter ?? argentinaTime(visit.workDate, 17) : null,
    })

  const setObjection = (objection: string) => update.mutateAsync({ objection: objection.trim() || null })
  const setRetry = (later: boolean) => update.mutateAsync({ retry_after: later ? argentinaTime(visit.workDate, 17) : null })
  const setNotes = (notes: string) => update.mutateAsync({ notes: notes.trim() || null })

  /** Ending waits for the photos still going up (usually already there by then). */
  const finishing = useMutation({
    mutationFn: async () => {
      if (!visit.consent) return
      if (!(await uploadsSettled(visit.id))) throw new PhotoError('Hay fotos que no se pudieron subir. Reintentalas antes de terminar.')
      await update.mutateAsync({ work_status: finishStatus(visit.consent) })
    },
  })

  /** "Volví: probar de nuevo": the closed store gets another try. */
  const retry = () =>
    update.mutateAsync(
      visit.workStatus === 'closed' ? { work_status: 'in_progress', consent: null, retry_after: null } : { consent: null, retry_after: null },
    )

  /** The new photo replaces the old one once it is safely on the server. */
  const replacePhoto = async (oldId: string, file: File) => {
    const old = visit.photos.find((p) => p.id === oldId)
    if (!old) return
    const queued = await add({ visitId: visit.id, displayId: old.displayId, kind: old.kind, file, sortOrder: 0 })
    if (queued && (await queued.done)) await remove.mutateAsync(oldId)
  }

  return {
    arrive,
    photo,
    setConsent,
    setObjection,
    setRetry,
    setNotes,
    finish: () => finishing.mutateAsync(),
    retry,
    replacePhoto,
    deletePhoto: (id: string) => remove.mutateAsync(id),
    retryPhoto: (id: string) => retryUpload(qc, id),
    /** Only while the photo is being compressed on the phone. */
    uploading: photos.preparing,
    saving: update.isPending || finishing.isPending,
    error: finishing.error ?? update.error ?? photoError ?? remove.error,
  }
}

export type VisitActions = ReturnType<typeof useVisitActions>
