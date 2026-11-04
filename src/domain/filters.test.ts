import { describe, expect, it } from 'vitest'
import { matchesAny, toIds } from './filters'

describe('filters of several', () => {
  it('none chosen is all; several is any of them; 0 is "without"', () => {
    expect(matchesAny(3, [], 0)).toBe(true)
    expect(matchesAny(3, [1, 3], 0)).toBe(true)
    expect(matchesAny(2, [1, 3], 0)).toBe(false)
    expect(matchesAny(null, [0, 1], 0)).toBe(true)
    expect(matchesAny('Almagro', ['Almagro', 'Villa Urquiza'], '')).toBe(true)
    expect(toIds(['1', 'x', '0'])).toEqual([1, 0])
  })
})
