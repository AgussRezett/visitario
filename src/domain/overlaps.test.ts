import { describe, expect, it } from 'vitest'
import { overlapText, overlapsByRow, type Overlap } from './overlaps'

const o = (extra: Partial<Overlap> = {}): Overlap => ({
  idx: 0, sameWorkday: false, merchandiserFirst: 'Lucía', merchandiserLast: 'Gómez', addedByFirst: 'Martín', addedByMerchandiser: false, workStatus: 'pending', ...extra,
})

describe('who else has the store that day', () => {
  it('says nothing when nobody has it', () => {
    expect(overlapText([], 'de hoy')).toBeNull()
  })

  it('names the activador and who assigned it', () => {
    expect(overlapText([o()], 'de hoy')).toBe('Lucía G. ya lo tiene en su jornada de hoy, asignado por Martín.')
  })

  it('says when the activador added it and how it is going', () => {
    expect(overlapText([o({ addedByMerchandiser: true, addedByFirst: 'Lucía', workStatus: 'done' })], 'de ese día')).toBe('Lucía G. ya lo tiene en su jornada de ese día, lo sumó por su cuenta y ya lo visitó.')
    expect(overlapText([o({ workStatus: 'in_progress' })], 'de hoy')).toBe('Lucía G. ya lo tiene en su jornada de hoy, asignado por Martín y está ahí ahora.')
  })

  it('lists several people once each', () => {
    const list = [o(), o({ merchandiserFirst: 'Diego', merchandiserLast: 'Paz' }), o({ merchandiserFirst: 'Sofía', merchandiserLast: 'Benítez' }), o()]
    expect(overlapText(list, 'de hoy')).toBe('Lucía G., Diego P. y Sofía B. ya lo tienen en su jornada de hoy.')
  })

  it('the same day comes first: there is nothing to add', () => {
    expect(overlapText([o(), o({ sameWorkday: true })], 'de hoy')).toBe('Ya está en esta jornada.')
  })

  it('groups the answers by the row asked', () => {
    const rows = overlapsByRow([o({ idx: 2 }), o({ idx: 0 }), o({ idx: 2, merchandiserFirst: 'Diego' })])
    expect(rows.get(2)?.length).toBe(2)
    expect(rows.get(0)?.length).toBe(1)
    expect(rows.get(1)).toBeUndefined()
  })
})
