import { describe, expect, it } from 'vitest'
import { readLines } from './paste-lines'

describe('pasting several addresses', () => {
  it('a table copied as text: one store per row, without the titles nor the separator', () => {
    const pasted = [
      '| Nro | Dirección | Zona | Vendedor |',
      '|-----|-----------|------|----------|',
      '| 92 | Venezuela 3943 | Almagro | Joaquin Pr. |',
      '| 313 | Av. Juan de Garay 3751 | Boedo | Joaquin Pr. |',
    ].join('\n')
    expect(readLines(pasted, [], []).map((l) => [l.customerNumber, l.address, l.area])).toEqual([
      ['92', 'Venezuela 3943', 'Almagro'],
      ['313', 'Av. Juan de Garay 3751', 'Boedo'],
    ])
  })
})
