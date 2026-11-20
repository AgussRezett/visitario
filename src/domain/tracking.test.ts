import { describe, expect, it } from 'vitest'
import { follow, sharesDay, shouldSend, type Fix, type Position } from './tracking'

const fix = (lat: number, lng: number, at: number, accuracy = 10): Fix => ({ lat, lng, at, accuracy })
// About 55 m north per 0.0005 of latitude.
const T0 = 1_000_000

describe('when the phone sends its position', () => {
  it('sends the first one, unless it is a guess', () => {
    expect(shouldSend(null, fix(-34.58, -58.43, T0))).toBe(true)
    expect(shouldSend(null, fix(-34.58, -58.43, T0, 400))).toBe(false)
  })
  it('standing still: once every 30 s', () => {
    const last = fix(-34.58, -58.43, T0)
    expect(shouldSend(last, fix(-34.58, -58.43, T0 + 20_000))).toBe(false)
    expect(shouldSend(last, fix(-34.58, -58.43, T0 + 30_000))).toBe(true)
  })
  it('walking: every 10 s once it moved 40 m', () => {
    const last = fix(-34.58, -58.43, T0)
    expect(shouldSend(last, fix(-34.5795, -58.43, T0 + 5_000))).toBe(false)
    expect(shouldSend(last, fix(-34.5795, -58.43, T0 + 12_000))).toBe(true)
    expect(shouldSend(last, fix(-34.5799, -58.43, T0 + 12_000))).toBe(false)
  })
})

describe('when the day is under way', () => {
  const v = (workStatus: 'pending' | 'in_progress' | 'done', arrivedAt: string | null = null) => ({ workStatus, arrivedAt })
  it('from the first arrival until every stop has a result', () => {
    expect(sharesDay('published', [v('pending'), v('pending')])).toBe(false)
    expect(sharesDay('published', [v('in_progress', '2026-11-20T12:00:00Z'), v('pending')])).toBe(true)
    expect(sharesDay('published', [v('done', '2026-11-20T12:00:00Z'), v('pending')])).toBe(true)
    expect(sharesDay('published', [v('done', '2026-11-20T12:00:00Z'), v('done', '2026-11-20T13:00:00Z')])).toBe(false)
  })
  it('never for a draft', () => {
    expect(sharesDay('draft', [v('in_progress', '2026-11-20T12:00:00Z')])).toBe(false)
  })
})

describe('what the supervisor follows', () => {
  const now = new Date('2026-11-20T15:00:00Z')
  const p = (device: string, at: string, lat: number, accuracy: number | null = 10): Position => ({ device, at, lat, lng: -58.43, accuracy })
  it('the latest position and the path of that phone, without guesses', () => {
    const f = follow([
      p('a', '2026-11-20T14:50:00Z', -34.58),
      p('a', '2026-11-20T14:55:00Z', -34.581, 500),
      p('b', '2026-11-20T14:56:00Z', -34.7),
      p('a', '2026-11-20T14:58:00Z', -34.582),
    ], now)
    expect(f?.last.lat).toBe(-34.582)
    expect(f?.trail).toEqual([[-58.43, -34.58], [-58.43, -34.582]])
    expect(f?.otherPhones).toBe(1)
    expect(f?.stale).toBe(false)
    expect(f?.minutes).toBe(2)
  })
  it('greys out after 5 minutes without news; nothing without positions', () => {
    expect(follow([p('a', '2026-11-20T14:50:00Z', -34.58)], now)?.stale).toBe(true)
    expect(follow([], now)).toBeNull()
  })
})
