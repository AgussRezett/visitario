import { describe, expect, it } from 'vitest'
import { freeSellers, sellerFor } from './sellers'

const s = (id: number, name: string, personId: string | null = null, active = true) => ({ id, name, personId, active })

describe('which loaded seller a person is', () => {
  const list = [s(1, 'Florencia Se'), s(2, 'Joaquin Pr'), s(3, 'Michael Di', 'p3'), s(4, 'Ruth'), s(5, 'Viejo', null, false)]

  it('only the active ones without a user can be taken', () => {
    expect(freeSellers(list).map((x) => x.id)).toEqual([1, 2, 4])
  })

  it('full name, first name, or first name + start of the surname', () => {
    expect(sellerFor('Florencia', 'Sereno', list)?.id).toBe(1)
    expect(sellerFor('Joaquín', 'Prieto', list)?.id).toBe(2)
    expect(sellerFor('Ruth', 'Rivas', list)?.id).toBe(4)
    expect(sellerFor('Michael', 'Díaz', list)).toBeNull() // already has a user
    expect(sellerFor('Florencia', 'Gómez', list)).toBeNull() // "Se" is not Gómez
  })

  it('when two could be them, none', () => {
    expect(sellerFor('Lucía', 'Gómez', [s(1, 'Lucía Gó'), s(2, 'Lucia G')])).toBeNull()
    expect(sellerFor('Lucía', 'Gómez', [s(1, 'Lucía Gómez'), s(2, 'Lucia G')])?.id).toBe(1) // the full name wins
  })
})
