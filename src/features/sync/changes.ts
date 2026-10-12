import { uuidv7 } from '@/lib/id'
import type { Enums } from '@/lib/supabase'
import type { Visit } from '@/features/workday/api/queries'
import { drop, enqueue, getSync } from './outbox'
import type { VisitFields } from './ops'

export interface NewPhotoFile {
  kind: Enums<'photo_kind'>
  displayId: string | null
  blob: Blob
  width: number
  height: number
  sortOrder: number
}

/**
 * Everything the merchandiser changes in a visit, written to the phone first.
 * Returns immediately; the outbox sends it when there is signal.
 */
export function visitChanges(visit: Pick<Visit, 'id' | 'companyId' | 'store'>) {
  const base = { visitId: visit.id, companyId: visit.companyId }
  const place = visit.store.name ?? visit.store.address
  const unsent = () => getSync().rows.filter((r) => !r.sent && r.op.visitId === visit.id)

  return {
    patch: (patch: VisitFields) => enqueue({ ...base, kind: 'visit.patch', patch }, place),
    remove: () => enqueue({ ...base, kind: 'visit.remove' }, place),

    addDisplay: async (typeId: number, sortOrder: number) => {
      const displayId = uuidv7()
      await enqueue({ ...base, kind: 'display.add', displayId, typeId, sortOrder }, place, { id: displayId })
      return displayId
    },
    patchDisplay: (displayId: string, change: { typeId?: number; reference?: string | null }) =>
      enqueue({ ...base, kind: 'display.patch', displayId, ...change }, place),
    /** A display that never reached the server just disappears, with its pending photos. */
    removeDisplay: async (displayId: string) => {
      const related = unsent().filter((r) => ('displayId' in r.op && r.op.displayId === displayId))
      const created = related.find((r) => r.op.kind === 'display.add')
      if (created && drop([created.id]).length) {
        drop(related.map((r) => r.id))
        return
      }
      await enqueue({ ...base, kind: 'display.remove', displayId }, place)
    },

    addPhoto: async (p: NewPhotoFile) => {
      const photoId = uuidv7()
      const op = { ...base, kind: 'photo.add' as const, photoId, displayId: p.displayId, photoKind: p.kind, takenAt: new Date().toISOString(), width: p.width, height: p.height, sortOrder: p.sortOrder }
      await enqueue(op, place, { id: photoId, blob: p.blob })
      return photoId
    },
    /** A photo still on the phone is simply dropped; one on the server is deleted there. */
    removePhoto: async (photoId: string) => {
      if (drop([photoId]).length) return
      await enqueue({ ...base, kind: 'photo.remove', photoId }, place)
    },

    setMetric: (metricId: number, quantity: number) => enqueue({ ...base, kind: 'metric.set', metricId, quantity }, place),
    setBrand: (brandId: number, on: boolean) => enqueue({ ...base, kind: 'brand.set', brandId, on }, place),

    /** A reply in the visit's conversation, from the merchandiser. */
    comment: async (authorId: string, body: string, displayId: string | null = null) => {
      const commentId = uuidv7()
      await enqueue({ ...base, kind: 'comment.add', commentId, authorId, body: body.trim(), displayId }, place, { id: commentId })
      return commentId
    },
    /** After a fix: back to the supervisor's queue. */
    resubmit: () => enqueue({ ...base, kind: 'visit.patch', patch: { review_status: 'unreviewed' } }, place),
  }
}

export type VisitChanges = ReturnType<typeof visitChanges>
