import { describe, expect, it } from 'vitest'
import { collapseResumed, originText, storeStats, usualDisplays, type StoreVisit } from './stores'

const visit = (workDate: string, extra: Partial<StoreVisit> = {}): StoreVisit => ({
  workDate, workStatus: 'done', reviewStatus: 'unreviewed', arrivedAt: null, finishedAt: null, displayTypeIds: [], ...extra,
})

describe('stores', () => {
  it('where a store came from', () => {
    expect(originText('imported', '2026-10-01T12:00:00Z', 'Martín')).toBe('Importado el 01/10 por Martín')
    expect(originText('merchandiser', '2026-10-09T12:00:00Z', 'Agus')).toBe('Agregado por Agus el 09/10')
  })

  it('its numbers', () => {
    const visits = [
      visit('2026-10-13', { arrivedAt: '2026-10-13T14:12:00Z', finishedAt: '2026-10-13T14:58:00Z' }),
      visit('2026-10-02', { reviewStatus: 'approved', arrivedAt: '2026-10-02T13:05:00Z', finishedAt: '2026-10-02T13:41:00Z' }),
      visit('2026-08-20', { workStatus: 'refused' }),
    ]
    expect(storeStats(visits, '2026-10-13')).toEqual({ last30: 2, approved: 1, refused: 1, averageMinutes: 41 })
  })

  it('usual displays from the last visits', () => {
    const name = (id: number) => ({ 1: 'Puntera', 3: 'Góndola', 4: 'Isla' })[id] ?? 'Otra'
    const visits = [visit('2026-10-13', { displayTypeIds: [1, 1, 3] }), visit('2026-10-02', { displayTypeIds: [1] }), visit('2026-01-01', { displayTypeIds: [4] })]
    expect(usualDisplays(visits, name, 2)).toEqual(['Puntera', 'Góndola'])
  })
})

describe('resumed visits', () => {
  it('the pending one carried to another day is shown once, on the day it was done', () => {
    const visits = [
      { id: 'b', workDate: '2026-10-09', resumedFrom: 'a' },
      { id: 'a', workDate: '2026-10-08', resumedFrom: null },
      { id: 'c', workDate: '2026-10-01', resumedFrom: null },
    ]
    expect(collapseResumed(visits, new Set(['a']))).toEqual([
      { id: 'b', workDate: '2026-10-09', resumedFrom: 'a', resumedOn: '2026-10-08' },
      { id: 'c', workDate: '2026-10-01', resumedFrom: null, resumedOn: null },
    ])
  })

  it('resumed from a visit of another store: no date to show', () => {
    expect(collapseResumed([{ id: 'b', workDate: '2026-10-09', resumedFrom: 'x' }], new Set())[0]?.resumedOn).toBeNull()
  })
})
