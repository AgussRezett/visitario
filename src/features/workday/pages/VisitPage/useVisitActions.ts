import { useMemo, useState } from 'react'
import { argentinaTime } from '@/domain/dates'
import { finishStatus, type Consent } from '@/domain/visit'
import type { Rapport } from '@/domain/reputation'
import type { Visit } from '@/features/workday/api/queries'
import { PhotoError, usePreparePhoto } from '@/features/workday/api/photos'
import { visitChanges } from '@/features/sync/changes'
import { retry, whenSent } from '@/features/sync/outbox'

/**
 * Everything the visit sheet can do, in the order the merchandiser does it. All of it is
 * saved on the phone first and works without signal; the outbox sends it in order
 * (so the storefront photo always reaches the server before the visit is finished).
 */
export function useVisitActions(visit: Visit) {
  const changes = useMemo(() => visitChanges(visit), [visit])
  const photos = usePreparePhoto()
  const [photoError, setPhotoError] = useState<Error | null>(null)

  const addPhoto = async (kind: Visit['photos'][number]['kind'], displayId: string | null, file: File, sortOrder: number) => {
    setPhotoError(null)
    try {
      const { blob, width, height } = await photos.prepare(file)
      return await changes.addPhoto({ kind, displayId, blob, width, height, sortOrder })
    } catch (e) {
      setPhotoError(e instanceof Error ? e : new PhotoError('No pudimos agregar la foto.'))
      return null
    }
  }

  /** Arrival = storefront photo: the visit starts on screen at once, the server follows. */
  const arrive = async (file: File) => {
    await addPhoto('storefront', null, file, 0)
  }

  const photo = async (displayId: string, kind: 'before' | 'after', file: File) => {
    await addPhoto(kind, displayId, file, visit.photos.filter((p) => p.displayId === displayId && p.kind === kind).length)
  }

  const setConsent = (consent: Consent) =>
    changes.patch({
      consent,
      objection: consent === 'with_objection' ? visit.objection : null,
      retry_after: consent === 'closed' ? visit.retryAfter ?? argentinaTime(visit.workDate, 17) : null,
      // How they were received only applies when the buyer let them in.
      rapport: consent === 'yes' || consent === 'with_objection' ? visit.rapport : null,
    })

  const setObjection = (objection: string) => changes.patch({ objection: objection.trim() || null })
  const setRetry = (later: boolean) => changes.patch({ retry_after: later ? argentinaTime(visit.workDate, 17) : null })
  const setRapport = (rapport: Rapport | null) => changes.patch({ rapport })
  const setNotes = (notes: string) => changes.patch({ notes: notes.trim() || null })

  const finish = async () => {
    if (visit.consent) await changes.patch({ work_status: finishStatus(visit.consent) })
  }

  /** "Volví: probar de nuevo": the closed store gets another try. */
  const retryStore = () =>
    changes.patch(visit.workStatus === 'closed' ? { work_status: 'in_progress', consent: null, retry_after: null } : { consent: null, retry_after: null })

  /** The new photo replaces the old one once it is safely on the server. */
  const replacePhoto = async (oldId: string, file: File) => {
    const old = visit.photos.find((p) => p.id === oldId)
    if (!old) return
    const id = await addPhoto(old.kind, old.displayId, file, 0)
    if (id && (await whenSent(id))) await changes.removePhoto(oldId)
  }

  return {
    arrive,
    photo,
    setConsent,
    setObjection,
    setRetry,
    setRapport,
    setNotes,
    finish,
    retry: retryStore,
    replacePhoto,
    deletePhoto: (id: string) => changes.removePhoto(id),
    retryPhoto: (id: string) => retry(id),
    changes,
    /** Only while the photo is being compressed on the phone. */
    uploading: photos.preparing,
    saving: false,
    error: photoError,
  }
}

export type VisitActions = ReturnType<typeof useVisitActions>
