import { argentinaTime } from '@/domain/dates'
import { finishStatus, type Consent } from '@/domain/visit'
import type { Visit } from '@/features/workday/api/queries'
import { useUpdateVisit } from '@/features/workday/api/mutations'
import { useDeletePhoto, useUploadPhoto } from '@/features/workday/api/photos'

/** Everything the visit sheet can do, in the order the merchandiser does it. */
export function useVisitActions(visit: Visit) {
  const update = useUpdateVisit(visit.id)
  const upload = useUploadPhoto()
  const remove = useDeletePhoto()

  /** Arrival = storefront photo; the visit starts if it was pending. */
  const arrive = async (file: File) => {
    await upload.mutateAsync({ visitId: visit.id, displayId: null, kind: 'storefront', file })
    if (visit.workStatus === 'pending') await update.mutateAsync({ work_status: 'in_progress', arrived_at: new Date().toISOString() })
  }

  const photo = (displayId: string, kind: 'before' | 'after', file: File) =>
    upload.mutateAsync({ visitId: visit.id, displayId, kind, file, sortOrder: visit.photos.filter((p) => p.displayId === displayId && p.kind === kind).length })

  const setConsent = (consent: Consent) =>
    update.mutateAsync({
      consent,
      objection: consent === 'with_objection' ? visit.objection : null,
      retry_after: consent === 'closed' ? visit.retryAfter ?? argentinaTime(visit.workDate, 17) : null,
    })

  const setObjection = (objection: string) => update.mutateAsync({ objection: objection.trim() || null })
  const setRetry = (later: boolean) => update.mutateAsync({ retry_after: later ? argentinaTime(visit.workDate, 17) : null })
  const setNotes = (notes: string) => update.mutateAsync({ notes: notes.trim() || null })

  const finish = () => (visit.consent ? update.mutateAsync({ work_status: finishStatus(visit.consent) }) : Promise.resolve())

  /** "Volví: probar de nuevo": the closed store gets another try. */
  const retry = () =>
    update.mutateAsync(
      visit.workStatus === 'closed' ? { work_status: 'in_progress', consent: null, retry_after: null } : { consent: null, retry_after: null },
    )

  const replacePhoto = async (oldId: string, file: File) => {
    const old = visit.photos.find((p) => p.id === oldId)
    if (!old) return
    await upload.mutateAsync({ visitId: visit.id, displayId: old.displayId, kind: old.kind, file, sortOrder: 0 })
    await remove.mutateAsync(oldId)
  }

  return {
    arrive,
    photo,
    setConsent,
    setObjection,
    setRetry,
    setNotes,
    finish,
    retry,
    replacePhoto,
    deletePhoto: (id: string) => remove.mutateAsync(id),
    uploading: upload.isPending,
    saving: update.isPending,
    error: update.error ?? upload.error ?? remove.error,
  }
}

export type VisitActions = ReturnType<typeof useVisitActions>
