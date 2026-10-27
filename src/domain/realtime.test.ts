import { describe, expect, it } from 'vitest'
import { isMyEcho } from './realtime'

const change = (table: string, row: Record<string, unknown>, eventType = 'UPDATE') => ({ table, eventType, new: row })

describe('isMyEcho', () => {
  it('my own visit, comment and photo changes are echoes', () => {
    expect(isMyEcho(change('visit', { updated_by: 'me' }), 'me')).toBe(true)
    expect(isMyEcho(change('comment', { author_id: 'me' }, 'INSERT'), 'me')).toBe(true)
    expect(isMyEcho(change('photo', { created_by: 'me' }), 'me')).toBe(true)
  })
  it('someone else’s, or the system’s, are not', () => {
    expect(isMyEcho(change('visit', { updated_by: 'lucia' }), 'me')).toBe(false)
    expect(isMyEcho(change('visit', { updated_by: null }), 'me')).toBe(false)
  })
  it('a display or workday change may be someone else’s even if I created it', () => {
    expect(isMyEcho(change('display', { created_by: 'me' }, 'INSERT'), 'me')).toBe(true)
    expect(isMyEcho(change('display', { created_by: 'me', deleted_at: 'x' }), 'me')).toBe(false)
    expect(isMyEcho(change('workday', { created_by: 'me' }), 'me')).toBe(false)
  })
})
