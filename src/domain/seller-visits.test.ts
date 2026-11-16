import { describe, expect, it } from 'vitest'
import { cleanLines, itemSuggestions, orderMessage, percent, periodTarget } from './seller-visits'

describe('seller visits', () => {
  it('keeps the order lines worth sending', () => {
    expect(cleanLines([{ qty: 2, item: ' SKYY 750 ' }, { qty: 3, item: '  ' }, { qty: 0, item: 'Aperol' }, { qty: 12000, item: 'Campari' }]))
      .toEqual([{ qty: 2, item: 'SKYY 750' }, { qty: 1, item: 'Aperol' }, { qty: 9999, item: 'Campari' }])
  })

  it('writes the order as a WhatsApp message', () => {
    expect(orderMessage({
      store: { name: 'Coto Cabildo', address: 'Cabildo 2280', customerNumber: '1462' },
      lines: [{ qty: 2, item: 'SKYY 750 caja x6' }, { qty: 3, item: 'Aperol 1 L' }],
      note: 'Entregar el jueves', seller: 'Florencia Paz', date: '16/11',
    })).toBe([
      '*Pedido · Coto Cabildo · Cliente 1462*',
      'Cabildo 2280',
      '',
      '• 2 × SKYY 750 caja x6',
      '• 3 × Aperol 1 L',
      '\nNota: Entregar el jueves',
      '\n— Florencia, 16/11',
    ].join('\n'))
  })

  it('without a name, number or note it still reads well', () => {
    expect(orderMessage({ store: { name: null, address: 'Moldes 1365', customerNumber: null }, lines: [{ qty: 1, item: 'Campari' }], note: null, seller: 'Flor', date: '16/11' }))
      .toBe('*Pedido · Moldes 1365*\n\n• 1 × Campari\n\n— Flor, 16/11')
  })

  it('suggests what was asked before and the brands, once each', () => {
    expect(itemSuggestions([{ qty: 1, item: 'SKYY 750' }, { qty: 2, item: 'skyy 750' }], ['Campari', 'SKYY 750', ''])).toEqual(['SKYY 750', 'Campari'])
  })

  it('gives a percent that never passes 100', () => {
    expect(percent(12, 41)).toBe(29)
    expect(percent(70, 60)).toBe(100)
    expect(percent(3, 0)).toBe(0)
  })
})

describe('period target', () => {
  it('is the monthly target for a whole month, and in proportion otherwise', () => {
    expect(periodTarget(60, '2026-11-01', '2026-11-30')).toBe(60)
    expect(periodTarget(60, '2026-02-01', '2026-02-28')).toBe(60)
    expect(periodTarget(60, '2026-11-10', '2026-11-16')).toBe(14)
    expect(periodTarget(60, '2026-10-01', '2026-12-31')).toBe(184)
    expect(periodTarget(5, '2026-11-16', '2026-11-16')).toBe(1)
  })
})
