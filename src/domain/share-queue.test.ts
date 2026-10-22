import { describe, expect, it } from 'vitest'
import { buildSends, nextSend, shareFileName } from './share-queue'

const photos = [
  { id: 'f1', kind: 'storefront' as const, displayId: null },
  { id: 'b1', kind: 'before' as const, displayId: 'd1' },
  { id: 'b2', kind: 'before' as const, displayId: 'd2' },
  { id: 'a1', kind: 'after' as const, displayId: 'd1' },
  { id: 'a1b', kind: 'after' as const, displayId: 'd1' },
]
const displays = [
  { id: 'd1', label: 'Góndola 1', before: 'ANTES G1', after: 'DESPUÉS G1' },
  { id: 'd2', label: 'Puntera', before: 'ANTES P', after: 'DESPUÉS P' },
]

describe('share queue', () => {
  it('per display: storefront, every ANTES, then every DESPUÉS, each with its own photos and text', () => {
    const sends = buildSends({ address: 'Cabildo 2280', photos, displays, general: { before: 'x', after: 'y' } })
    expect(sends.map((s) => s.label)).toEqual(['Fachada', 'ANTES · Góndola 1', 'ANTES · Puntera', 'DESPUÉS · Góndola 1', 'DESPUÉS · Puntera'])
    expect(sends[0]).toMatchObject({ photoIds: ['f1'], text: 'Cabildo 2280' })
    expect(sends[3]).toMatchObject({ photoIds: ['a1', 'a1b'], text: 'DESPUÉS G1' })
    expect(sends[4]?.photoIds).toEqual([])
  })

  it('one per visit: the ANTES carries every display’s before photos', () => {
    const sends = buildSends({ address: 'Cabildo 2280', photos, displays: null, general: { before: 'ANTES', after: 'DESPUÉS' } })
    expect(sends.map((s) => [s.label, s.photoIds.length])).toEqual([['Fachada', 1], ['ANTES', 2], ['DESPUÉS', 2]])
  })

  it('the next one skips what was sent and what has no photo yet', () => {
    const sends = buildSends({ address: 'x', photos, displays, general: { before: '', after: '' } })
    expect(nextSend(sends, new Set())?.key).toBe('storefront')
    expect(nextSend(sends, new Set(['storefront', 'before-d1', 'before-d2']))?.key).toBe('after-d1')
    expect(nextSend(sends, new Set(['storefront', 'before-d1', 'before-d2', 'after-d1']))).toBeNull()
  })

  it('names the files', () => {
    const [front, before] = buildSends({ address: 'x', photos, displays, general: { before: '', after: '' } })
    if (!front || !before) throw new Error('fixture')
    expect(shareFileName(before, 0)).toBe('ANTES - Góndola 1.jpg')
    expect(shareFileName(front, 1)).toBe('Fachada 2.jpg')
  })
})
