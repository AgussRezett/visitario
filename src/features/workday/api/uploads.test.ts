import { describe, expect, it } from 'vitest'
import type { Visit } from './queries'
import { withPendingUploads, type PendingUpload } from './uploads'

const visit = { id: 'v1', workStatus: 'pending', arrivedAt: null, photos: [] } as unknown as Visit
const pending = (id: string, kind: 'storefront' | 'before', visitId = 'v1'): PendingUpload => ({
  photo: { id, kind, displayId: kind === 'storefront' ? null : 'd1', takenAt: '2026-10-12T15:00:00Z', uploaded: false },
  visitId,
  state: 'uploading',
  blob: new Blob(),
  width: 1,
  height: 1,
  sortOrder: 0,
  done: Promise.resolve(true),
})

describe('withPendingUploads', () => {
  it('starts the visit as soon as the storefront photo is taken', () => {
    const v = withPendingUploads(visit, [pending('p1', 'storefront')])
    expect(v.workStatus).toBe('in_progress')
    expect(v.arrivedAt).toBe('2026-10-12T15:00:00Z')
    expect(v.photos.map((p) => p.id)).toEqual(['p1'])
  })
  it('ignores other visits and photos the server already has', () => {
    const synced = { ...visit, photos: [pending('p1', 'storefront').photo] }
    expect(withPendingUploads(synced, [pending('p1', 'storefront'), pending('p2', 'before', 'v2')])).toBe(synced)
  })
  it('a display photo alone does not start the visit', () => {
    expect(withPendingUploads(visit, [pending('p3', 'before')]).workStatus).toBe('pending')
  })
})
