import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { visitWorkQuery, type Visit } from '@/features/workday/api/queries'
import { applyToList, applyToVisit, applyToWork } from './overlay'
import { useSync, type Pending } from './outbox'

/** The day's stops as the merchandiser left them, including changes not sent yet. */
export function useVisitList(list: Visit[] | undefined) {
  const { rows } = useSync()
  return useMemo(() => (list ? applyToList(list, rows) : undefined), [list, rows])
}

/** One visit with its pending changes; null if it was taken off the day on this phone. */
export function useVisitView(visit: Visit | null | undefined) {
  const { rows } = useSync()
  return useMemo(() => (visit ? applyToVisit(visit, rows) : visit), [visit, rows])
}

/** Quantities and brands of a visit, including pending changes. */
export function useVisitWork(visitId: string) {
  const work = useQuery(visitWorkQuery(visitId))
  const { rows } = useSync()
  const data = useMemo(() => (work.data ? applyToWork(work.data, visitId, rows) : undefined), [work.data, visitId, rows])
  return { ...work, data }
}

export type UploadState = 'uploading' | 'failed'

/** Whether a photo is still on its way to the server, or was refused. */
export function uploadStateOf(photoId: string, rows: readonly Pending[]): UploadState | undefined {
  const row = rows.find((r) => r.id === photoId && r.op.kind === 'photo.add')
  if (!row) return undefined
  if (row.state === 'failed') return 'failed'
  return row.sent ? undefined : 'uploading'
}

export function useUploadState(photoId: string | undefined) {
  const { rows } = useSync()
  return photoId ? uploadStateOf(photoId, rows) : undefined
}
