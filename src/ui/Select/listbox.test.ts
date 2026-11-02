import { describe, expect, it } from 'vitest'
import { edge, filterOptions, placeBelowOrAbove, step, typeahead } from './listbox'

const opts = [
  { value: '', label: 'Todas' },
  { value: 'b', label: 'Belgrano' },
  { value: 'x', label: 'Barracas', disabled: true },
  { value: 'bo', label: 'Boedo' },
  { value: 'p', label: 'Palermo', hint: 'CABA norte' },
  { value: 'n', label: 'Núñez' },
]

describe('Select list', () => {
  it('moves over enabled options and stays at the ends', () => {
    expect(step(opts, 1, 1)).toBe(3) // skips Barracas (disabled)
    expect(step(opts, 5, 1)).toBe(5)
    expect(step(opts, 0, -1)).toBe(0)
    expect(step(opts, -1, 1)).toBe(0)
    expect(edge(opts, 'last')).toBe(5)
  })

  it('searches every word, without accents, in label and hint', () => {
    expect(filterOptions(opts, 'nunez').map((o) => o.value)).toEqual(['n'])
    expect(filterOptions(opts, 'caba norte').map((o) => o.value)).toEqual(['p'])
    expect(filterOptions(opts, '  ')).toHaveLength(opts.length)
  })

  it('type-ahead: a word jumps to it; the same letter again goes to the next one', () => {
    expect(typeahead(opts, 0, 'bo')).toBe(3)
    expect(typeahead(opts, 0, 'b')).toBe(1)
    expect(typeahead(opts, 1, 'bb')).toBe(3) // Barracas is disabled
    expect(typeahead(opts, 0, 'z')).toBe(0)
  })

  it('opens under the trigger, or above when there is no room below', () => {
    const view = { width: 1440, height: 900 }
    expect(placeBelowOrAbove({ top: 100, bottom: 140, left: 300, width: 200 }, view, 300)).toMatchObject({ top: 146, left: 300, width: 220 })
    const up = placeBelowOrAbove({ top: 800, bottom: 840, left: 1400, width: 200 }, view, 300)
    expect(up.bottom).toBe(106)
    expect(up.left + up.width).toBeLessThanOrEqual(1432)
  })
})
