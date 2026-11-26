import { describe, expect, it } from 'vitest'
import { albumCaption, buildSends, nextSend, observationText, shareFileName } from './share-queue'

const photos = [
  { id: 'f1', kind: 'storefront' as const, displayId: null },
  { id: 'b1', kind: 'before' as const, displayId: 'd1' },
  { id: 'b2', kind: 'before' as const, displayId: 'd2' },
  { id: 'a1', kind: 'after' as const, displayId: 'd1' },
  { id: 'a1b', kind: 'after' as const, displayId: 'd1' },
]
const perDisplay = (kind: 'ANTES' | 'DESPUÉS') => [
  { key: 'd1', label: 'Góndola 1', displayIds: ['d1'], text: `${kind} G1` },
  { key: 'd2', label: 'Puntera', displayIds: ['d2'], text: `${kind} P` },
]
const displays = { before: perDisplay('ANTES'), after: perDisplay('DESPUÉS') }
const whole = (before: string, after: string) => ({ before: [{ key: 'visit', label: null, displayIds: null, text: before }], after: [{ key: 'visit', label: null, displayIds: null, text: after }] })

describe('share queue', () => {
  it('per display: storefront, every ANTES, then every DESPUÉS, each with its own photos and text', () => {
    const sends = buildSends({ address: 'Cabildo 2280', photos, ...displays })
    expect(sends.map((s) => s.label)).toEqual(['Fachada', 'ANTES · Góndola 1', 'ANTES · Puntera', 'DESPUÉS · Góndola 1', 'texto de DESPUÉS · Góndola 1', 'DESPUÉS · Puntera'])
    expect(sends[0]).toMatchObject({ photoIds: ['f1'], text: 'Cabildo 2280' })
    // Two photos: they go as one album, and the text right after as its own message.
    expect(sends[3]).toMatchObject({ photoIds: ['a1', 'a1b'], text: '' })
    expect(sends[4]).toMatchObject({ key: 'after-d1-text', photoIds: [], text: 'DESPUÉS G1', textOnly: true, ofAlbum: 'after-d1' })
    expect(sends[5]?.photoIds).toEqual([])
  })

  it('one per visit: the ANTES carries every display’s before photos', () => {
    const sends = buildSends({ address: 'Cabildo 2280', photos, ...whole('ANTES', 'DESPUÉS') })
    expect(sends.map((s) => [s.label, s.photoIds.length])).toEqual([['Fachada', 1], ['ANTES', 2], ['texto de ANTES', 0], ['DESPUÉS', 2], ['texto de DESPUÉS', 0]])
  })

  it('ANTES and DESPUÉS each grouped their own way: one for the visit, then one per kind of display', () => {
    const sends = buildSends({
      address: 'x', photos, before: whole('ANTES', '').before,
      after: [{ key: 'type-1', label: 'Góndola (2)', displayIds: ['d1', 'd3'], text: 'DESPUÉS G' }, { key: 'type-2', label: 'Puntera', displayIds: ['d2'], text: 'DESPUÉS P' }],
    })
    expect(sends.map((s) => [s.key, s.label, s.photoIds])).toEqual([
      ['storefront', 'Fachada', ['f1']], ['before', 'ANTES', ['b1', 'b2']], ['before-text', 'texto de ANTES', []],
      ['after-type-1', 'DESPUÉS · Góndola (2)', ['a1', 'a1b']], ['after-type-1-text', 'texto de DESPUÉS · Góndola (2)', []], ['after-type-2', 'DESPUÉS · Puntera', []],
    ])
  })

  it('several photos go as one album, the text apart (WhatsApp would repeat it on each)', () => {
    expect([albumCaption(1), albumCaption(3)]).toEqual([false, true])
  })

  it('the next one skips what was sent and what has no photo yet', () => {
    const sends = buildSends({ address: 'x', photos, ...displays })
    expect(nextSend(sends, new Set())?.key).toBe('storefront')
    expect(nextSend(sends, new Set(['storefront', 'before-d1', 'before-d2']))?.key).toBe('after-d1')
    // After an album, its text.
    expect(nextSend(sends, new Set(['storefront', 'before-d1', 'before-d2', 'after-d1']))?.key).toBe('after-d1-text')
    expect(nextSend(sends, new Set(['storefront', 'before-d1', 'before-d2', 'after-d1', 'after-d1-text']))).toBeNull()
  })

  it('the observations go last, text only, and only when there are any', () => {
    const sends = buildSends({ address: 'x', photos, ...whole('', ''), notes: '  Faltó Campari en la góndola  ' })
    expect(sends.at(-1)).toMatchObject({ key: 'notes', label: 'Observaciones', photoIds: [], textOnly: true, text: 'Observaciones: Faltó Campari en la góndola' })
    expect(nextSend(sends, new Set(['storefront', 'before', 'after']))?.key).toBe('notes')
    // An album with no text has no text to send after it.
    expect(sends.some((s) => s.ofAlbum)).toBe(false)
    expect(buildSends({ address: 'x', photos, ...whole('', ''), notes: '  ' }).some((s) => s.key === 'notes')).toBe(false)
    expect(observationText(null)).toBeNull()
  })

  it('names the files', () => {
    const [front, before] = buildSends({ address: 'x', photos, ...displays })
    if (!front || !before) throw new Error('fixture')
    expect(shareFileName(before, 0)).toBe('ANTES - Góndola 1.jpg')
    expect(shareFileName(front, 1)).toBe('Fachada 2.jpg')
  })
})
