import { describe, expect, it } from 'vitest'
import { transcriptToLines } from '@/domain/capture'
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

  it('the lines a capture fills in read back as the same stores', () => {
    const sellers = [{ id: 7, name: 'Ana Ga' }]
    const lines = transcriptToLines({ title: '', headers: ['COD', 'DOMICILIO', 'BARRIO', 'VENDEDOR'], rows: [['10', 'MUÑIZ 10', 'VILLA DEVOTO', 'ANA GA.'], ['', 'CASTRO 20', '', '']], unreadable: 0 }, sellers)
    expect(readLines(lines.join('\n'), sellers, []).map((l) => [l.customerNumber, l.address, l.area, l.sellerId])).toEqual([
      ['10', 'Muñiz 10', 'Villa Devoto', 7],
      ['', 'Castro 20', '', null],
    ])
  })
})
