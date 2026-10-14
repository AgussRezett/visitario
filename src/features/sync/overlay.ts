import type { Visit } from '@/features/workday/api/queries'
import type { OutboxRow } from './db'
import type { VisitFields } from './ops'

/**
 * What the merchandiser sees = what the server has + the changes still on the phone.
 * These mirror the database rules (storefront photo starts the visit, deleting the last
 * one sends it back to pending) so the screen does not change when the server confirms.
 */

const FINISHED = new Set(['done', 'refused', 'closed'])

function patchVisit(v: Visit, p: VisitFields, at: string): Visit {
  const next: Visit = {
    ...v,
    ...(p.work_status !== undefined ? { workStatus: p.work_status } : {}),
    ...(p.arrived_at !== undefined ? { arrivedAt: p.arrived_at } : {}),
    ...(p.consent !== undefined ? { consent: p.consent } : {}),
    ...(p.objection !== undefined ? { objection: p.objection } : {}),
    ...(p.retry_after !== undefined ? { retryAfter: p.retry_after } : {}),
    ...(p.notes !== undefined ? { notes: p.notes } : {}),
    ...(p.task !== undefined ? { task: p.task } : {}),
    ...(p.sort_order !== undefined ? { sortOrder: p.sort_order } : {}),
    ...(p.review_status !== undefined ? { reviewStatus: p.review_status } : {}),
  }
  if (p.work_status !== undefined) {
    next.finishedAt = FINISHED.has(p.work_status) ? v.finishedAt ?? at : null
  }
  return next
}

/** One visit with its pending changes applied, or null if it was taken off the day. */
export function applyToVisit(visit: Visit, rows: readonly OutboxRow[]): Visit | null {
  let v = visit
  for (const { op, createdAt, state } of rows) {
    // Refused changes are not shown as done, except photos: they stay (marked) to retry.
    if (op.visitId !== visit.id || (state === 'failed' && op.kind !== 'photo.add')) continue
    switch (op.kind) {
      case 'visit.patch':
        v = patchVisit(v, op.patch, createdAt)
        break
      case 'visit.remove':
        return null
      case 'display.add':
        if (!v.displays.some((d) => d.id === op.displayId)) {
          v = { ...v, displays: [...v.displays, { id: op.displayId, typeId: op.typeId, reference: null, source: 'found', sortOrder: op.sortOrder }] }
        }
        break
      case 'display.patch':
        v = {
          ...v,
          displays: v.displays.map((d) =>
            d.id === op.displayId
              ? { ...d, ...(op.typeId !== undefined ? { typeId: op.typeId } : {}), ...(op.reference !== undefined ? { reference: op.reference } : {}) }
              : d,
          ),
        }
        break
      case 'display.remove':
        v = { ...v, displays: v.displays.filter((d) => d.id !== op.displayId) }
        break
      case 'photo.add':
        if (!v.photos.some((p) => p.id === op.photoId)) {
          v = { ...v, photos: [...v.photos, { id: op.photoId, kind: op.photoKind, displayId: op.displayId, takenAt: op.takenAt, uploaded: false }] }
          if (op.photoKind === 'storefront' && v.workStatus === 'pending') v = { ...v, workStatus: 'in_progress', arrivedAt: v.arrivedAt ?? op.takenAt }
        }
        break
      case 'photo.remove': {
        const photos = v.photos.filter((p) => p.id !== op.photoId)
        v = { ...v, photos }
        if (v.workStatus !== 'pending' && !photos.some((p) => p.kind === 'storefront')) {
          v = { ...v, workStatus: 'pending', arrivedAt: null, consent: null, objection: null, retryAfter: null, finishedAt: null }
        }
        break
      }
      default:
        break
    }
  }
  return v
}

/** The day's list with pending changes applied; stops taken off the day are left out. */
export function applyToList(list: readonly Visit[], rows: readonly OutboxRow[]): Visit[] {
  if (!rows.length) return list as Visit[]
  const next = list.flatMap((v) => applyToVisit(v, rows) ?? [])
  // A route applied on the phone moves visits before it reaches the server.
  return rows.some((r) => r.op.kind === 'visit.patch' && r.op.patch.sort_order !== undefined) ? next.sort((a, b) => a.sortOrder - b.sortOrder) : next
}

export interface VisitWork {
  metrics: Record<number, number>
  brands: number[]
}

/** Quantities and brands of a visit with pending changes applied. */
export function applyToWork(work: VisitWork, visitId: string, rows: readonly OutboxRow[]): VisitWork {
  let metrics = work.metrics
  let brands = work.brands
  for (const { op, state } of rows) {
    if (op.visitId !== visitId || state === 'failed') continue
    if (op.kind === 'metric.set') metrics = { ...metrics, [op.metricId]: op.quantity }
    if (op.kind === 'brand.set') brands = op.on ? (brands.includes(op.brandId) ? brands : [...brands, op.brandId]) : brands.filter((b) => b !== op.brandId)
  }
  return metrics === work.metrics && brands === work.brands ? work : { metrics, brands }
}
