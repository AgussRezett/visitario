import { describe, expect, it } from 'vitest'
import { outcomeText, pasteOutcome, repeatedLines } from './paste-results'

describe('pasteOutcome', () => {
  const texts = ['1362; José Cubas 2770', '1355; Mosconi 3235', '525; Congreso 3576', '99999', 'Vallejos 3136']
  const results = [
    { idx: 0, created: true, error: null, detail: null },
    { idx: 1, created: false, error: null, detail: null },
    { idx: 2, created: false, error: 'archived_customer', detail: 'Av. Congreso 3576' },
    { idx: 3, created: false, error: 'no_address', detail: null },
  ]

  it('counts what went in and keeps every line that did not, with why', () => {
    const o = pasteOutcome(texts, results)
    expect(o.added).toBe(1)
    expect(o.already).toBe(1)
    expect(o.failed.map((f) => f.text)).toEqual(['525; Congreso 3576', '99999', 'Vallejos 3136'])
    expect(o.failed[0]?.reason).toContain('archivado (Av. Congreso 3576)')
    expect(o.failed[1]?.reason).toContain('sumá la dirección')
    // No answer for a line: it is not lost.
    expect(o.failed[2]?.reason).toContain('Probá de nuevo')
  })

  it('says it short', () => {
    expect(outcomeText({ added: 18, already: 1, repeated: 1, failed: [] })).toBe('Agregamos 18 locales · 1 estaba repetido en la lista · 1 ya estaba en la jornada')
    expect(outcomeText({ added: 1, already: 0, repeated: 0, failed: [] })).toBe('Agregamos 1 local')
  })
})

describe('repeatedLines', () => {
  it('finds the same customer number twice, or the same address without one', () => {
    const lines = [
      { customerNumber: '1362', address: 'José Cubas 2770' },
      { customerNumber: '975', address: 'Pareja 2351' },
      { customerNumber: '', address: 'Moldes 1365' },
      { customerNumber: '1362', address: 'José Cubas 2770' },
      { customerNumber: '', address: 'MOLDES  1365' },
    ]
    expect([...repeatedLines(lines)]).toEqual([[3, 0], [4, 2]])
  })

  it('counts a repeated line apart from one already in the day', () => {
    const o = pasteOutcome(['a', 'a', 'b'], [
      { idx: 0, created: true, error: null, detail: null },
      { idx: 1, created: false, error: null, detail: null },
      { idx: 2, created: false, error: null, detail: null },
    ], new Map([[1, 0]]))
    expect([o.added, o.repeated, o.already]).toEqual([1, 1, 1])
  })
})
