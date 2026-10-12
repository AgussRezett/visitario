import { describe, expect, it } from 'vitest'
import type { Visit } from '@/features/workday/api/queries'
import type { OutboxRow } from './db'
import { isPermanentStatus, type Op } from './ops'
import { applyToList, applyToVisit, applyToWork } from './overlay'

const visit = {
  id: 'v1', companyId: 'c1', workStatus: 'pending', arrivedAt: null, consent: null, objection: null, retryAfter: null, finishedAt: null, notes: null,
  displays: [], photos: [], store: { address: 'Moldes 1365', name: null },
} as unknown as Visit

let n = 0
const row = (op: Partial<Op> & { kind: Op['kind'] }, state: OutboxRow['state'] = 'pending'): OutboxRow => ({
  id: `r${++n}`, op: { visitId: 'v1', companyId: 'c1', ...op } as Op, label: '', createdAt: '2026-10-12T15:00:00Z', state, attempts: 0,
})
const storefront = (photoId = 'p1') => row({ kind: 'photo.add', photoId, displayId: null, photoKind: 'storefront', takenAt: '2026-10-12T14:59:00Z', width: 1, height: 1, sortOrder: 0 })

describe('applyToVisit', () => {
  it('a storefront photo taken without signal starts the visit at once', () => {
    const v = applyToVisit(visit, [storefront()])
    expect(v?.workStatus).toBe('in_progress')
    expect(v?.arrivedAt).toBe('2026-10-12T14:59:00Z')
    expect(v?.photos).toHaveLength(1)
  })

  it('finishing shows as finished with its time', () => {
    const v = applyToVisit(visit, [storefront(), row({ kind: 'visit.patch', patch: { consent: 'yes' } }), row({ kind: 'visit.patch', patch: { work_status: 'done' } })])
    expect(v?.workStatus).toBe('done')
    expect(v?.consent).toBe('yes')
    expect(v?.finishedAt).toBe('2026-10-12T15:00:00Z')
  })

  it('deleting the last storefront photo sends it back to pending, like the database', () => {
    const v = applyToVisit(visit, [storefront(), row({ kind: 'visit.patch', patch: { consent: 'yes', work_status: 'done' } }), row({ kind: 'photo.remove', photoId: 'p1' })])
    expect(v).toMatchObject({ workStatus: 'pending', consent: null, arrivedAt: null, finishedAt: null, photos: [] })
  })

  it('displays are added, edited and removed', () => {
    const v = applyToVisit(visit, [
      row({ kind: 'display.add', displayId: 'd1', typeId: 3, sortOrder: 0 }),
      row({ kind: 'display.add', displayId: 'd2', typeId: 3, sortOrder: 1 }),
      row({ kind: 'display.patch', displayId: 'd1', reference: 'Fernet' }),
      row({ kind: 'display.remove', displayId: 'd2' }),
    ])
    expect(v?.displays).toEqual([{ id: 'd1', typeId: 3, reference: 'Fernet', source: 'found', sortOrder: 0 }])
  })

  it('refused changes are not shown as done, except photos to retry', () => {
    const v = applyToVisit(visit, [row({ kind: 'visit.patch', patch: { notes: 'x' } }, 'failed'), { ...storefront('p2'), state: 'failed' }])
    expect(v?.notes).toBeNull()
    expect(v?.photos.map((p) => p.id)).toEqual(['p2'])
  })

  it('other visits are untouched', () => {
    expect(applyToVisit({ ...visit, id: 'v2' } as Visit, [storefront()])?.photos).toEqual([])
  })
})

describe('applyToList', () => {
  it('a stop taken off the day disappears', () => {
    expect(applyToList([visit, { ...visit, id: 'v2' } as Visit], [row({ kind: 'visit.remove' })]).map((v) => v.id)).toEqual(['v2'])
  })
})

describe('applyToWork', () => {
  it('quantities and brands follow the last change', () => {
    const work = applyToWork({ metrics: { 1: 2 }, brands: [5] }, 'v1', [
      row({ kind: 'metric.set', metricId: 1, quantity: 4 }),
      row({ kind: 'brand.set', brandId: 5, on: false }),
      row({ kind: 'brand.set', brandId: 7, on: true }),
    ])
    expect(work).toEqual({ metrics: { 1: 4 }, brands: [7] })
  })
})

describe('isPermanentStatus', () => {
  it('only a real refusal stops retrying', () => {
    expect([400, 403, 404, 409, 413].every(isPermanentStatus)).toBe(true)
    expect([0, 401, 408, 429, 500, 502, 503].some(isPermanentStatus)).toBe(false)
  })
})
