import { describe, expect, it } from 'vitest'
import { follow, sharesDay, shouldSend, whereabouts, type Fix, type Position, type StopTimes } from './tracking'

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
    // The path up to the last one (the dot is drawn at the last).
    expect(f?.trail).toEqual([[-58.43, -34.58]])
    expect(f?.otherPhones).toBe(1)
    expect(f?.stale).toBe(false)
    expect(f?.minutes).toBe(2)
  })
  it('greys out after 5 minutes without news; nothing without positions', () => {
    expect(follow([p('a', '2026-11-20T14:50:00Z', -34.58)], now)?.stale).toBe(true)
    expect(follow([], now)).toBeNull()
  })
})

describe('the path between stops, with the app closed', () => {
  const now = new Date('2026-11-20T15:00:00Z')
  const stop = (name: string, lat: number, workStatus: StopTimes['workStatus'], arrivedAt: string | null = null, finishedAt: string | null = null): StopTimes =>
    ({ name, lat, lng: -58.43, workStatus, arrivedAt, finishedAt })
  const day = [
    stop('Tres Arroyos 762', -34.58, 'done', '2026-11-20T13:00:00Z', '2026-11-20T13:30:00Z'),
    stop('Juramento 2101', -34.59, 'done', '2026-11-20T14:00:00Z', '2026-11-20T14:35:00Z'),
    stop('Cuba 1940', -34.6, 'pending'),
  ]

  it('goes through each stop when they arrived and left, between the phone positions', () => {
    const f = follow([{ device: 'a', at: '2026-11-20T13:10:00Z', lat: -34.581, lng: -58.43, accuracy: 10 }], now, day)
    expect(f?.trail).toEqual([[-58.43, -34.58], [-58.43, -34.581], [-58.43, -34.58], [-58.43, -34.59]])
    // Last known: leaving Juramento, 25 minutes ago.
    expect(f?.last).toMatchObject({ lat: -34.59, device: null })
    expect(f?.minutes).toBe(25)
    expect(f?.stale).toBe(true)
  })

  it('without the phone ever sending, the stops still say where they went', () => {
    expect(follow([], now, day)?.last.lat).toBe(-34.59)
    expect(follow([], now, [stop('Cuba 1940', -34.6, 'pending')])).toBeNull()
  })

  it('says where they are: at a stop, on the way to the next one, or done', () => {
    expect(whereabouts(day)).toEqual({ kind: 'between', from: 'Juramento 2101', left: '2026-11-20T14:35:00Z', to: day[2] })
    const working = [...day.slice(0, 2), stop('Cuba 1940', -34.6, 'in_progress', '2026-11-20T14:55:00Z')]
    expect(whereabouts(working)).toEqual({ kind: 'at', place: 'Cuba 1940', since: '2026-11-20T14:55:00Z' })
    expect(whereabouts(day.slice(0, 2))).toEqual({ kind: 'done' })
    expect(whereabouts([stop('Cuba 1940', -34.6, 'pending')])).toBeNull()
  })
})
