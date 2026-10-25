import { describe, expect, it } from 'vitest'
import { affected, chunks, effective, isEmptyChange, shared, type BulkRow } from './bulk-edit'

const row = (sellerId: number | null, channelId: number | null, area: string | null): BulkRow => ({ sellerId, channelId, area })

describe('bulk edit', () => {
  it('says the value when all share it, and "several" when not', () => {
    expect(shared([null, null])).toEqual({ mixed: false, value: null })
    expect(shared([3, 3, 3])).toEqual({ mixed: false, value: 3 })
    expect(shared([3, null, 4, 3])).toEqual({ mixed: true, distinct: 3 })
  })

  it('counts only the stores that really change', () => {
    const rows = [row(null, 1, 'Palermo'), row(2, 1, 'Palermo'), row(null, null, null)]
    expect(affected(rows, { sellerId: 2 })).toBe(2)
    expect(affected(rows, { channelId: 1 })).toBe(1)
    expect(affected(rows, { area: 'palermo ' })).toBe(1) // same zone, written another way
    expect(affected(rows, {})).toBe(0)
  })

  it('drops the fields that change nothing', () => {
    const rows = [row(2, 1, 'Palermo'), row(2, 1, 'Belgrano')]
    expect(effective(rows, { sellerId: 2, channelId: null, area: 'Palermo' })).toEqual({ channelId: null, area: 'Palermo' })
    expect(isEmptyChange(effective(rows, { sellerId: 2 }))).toBe(true)
  })

  it('splits a long list of ids', () => {
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunks([], 2)).toEqual([])
  })
})
