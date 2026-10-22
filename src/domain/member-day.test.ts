import { describe, expect, it } from 'vitest'
import { dayFocus, stopOrigin, stopTiming } from './member-day'

describe('an activador’s day seen by the supervisor', () => {
  it('finds where they are and what comes next, in their order', () => {
    const stops = [
      { id: 'a', workStatus: 'done' as const },
      { id: 'b', workStatus: 'pending' as const },
      { id: 'c', workStatus: 'in_progress' as const },
      { id: 'd', workStatus: 'pending' as const },
    ]
    expect(dayFocus(stops)).toEqual({ currentId: 'c', nextId: 'b' })
    expect(dayFocus([{ id: 'a', workStatus: 'done' }])).toEqual({ currentId: null, nextId: null })
  })

  it('says who put each stop in the day', () => {
    expect(stopOrigin({ source: 'assigned', addedByName: 'Martín', addedByMe: false }, 'Lucía')).toBe('Asignada por Martín')
    expect(stopOrigin({ source: 'added', addedByName: 'Lucía', addedByMe: true }, 'Lucía')).toBe('Agregada por Lucía')
    expect(stopOrigin({ source: 'added', addedByName: null, addedByMe: false }, 'Lucía')).toBe('Agregada por Lucía')
    expect(stopOrigin({ source: 'assigned', addedByName: null, addedByMe: false }, 'Lucía')).toBe('Asignada')
  })

  it('tells when things happened', () => {
    expect(stopTiming({ workStatus: 'pending', arrivedAt: null, finishedAt: null, retryAfter: null })).toBeNull()
    expect(stopTiming({ workStatus: 'in_progress', arrivedAt: '2026-10-12T14:02:00Z', finishedAt: null, retryAfter: null })).toBe('Llegó 11:02')
    expect(stopTiming({ workStatus: 'done', arrivedAt: '2026-10-12T14:02:00Z', finishedAt: '2026-10-12T14:31:00Z', retryAfter: null })).toBe('Terminó 11:31')
    expect(stopTiming({ workStatus: 'closed', arrivedAt: null, finishedAt: '2026-10-12T14:31:00Z', retryAfter: '2026-10-12T20:00:00Z' })).toMatch(/^Vuelve 17/)
  })
})
