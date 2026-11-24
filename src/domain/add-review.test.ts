import { describe, expect, it } from 'vitest'
import { applyKnown, assignSeller, channelIn, keepEdits, rowProblem, rowsFromLines, rowsFromTranscript, unknownSellers, type ReviewRow } from './add-review'

const sellers = [{ id: 1, name: 'Mirko Ra' }, { id: 2, name: 'Florencia' }]
const channels = [{ id: 10, name: 'Kiosco' }, { id: 11, name: 'Autoservicio' }, { id: 12, name: 'Mayorista' }]

const row = (extra: Partial<ReviewRow> = {}): ReviewRow => ({
  key: 'k', customerNumber: '', address: 'Cabildo 2245', area: '', sellerId: null, sellerName: '', channel: '', task: '', ...extra,
})

describe('rows from lines pasted one by one', () => {
  it('keeps each part, the seller and channel mentioned, and the task of the address', () => {
    const rows = rowsFromLines([
      { text: '564; Lacroze 3265; Belgrano @Mirko Ra #Kiosco', customerNumber: '564', address: 'Lacroze 3265', area: 'Belgrano', sellerId: 1, channelId: 10, unknown: [] },
      { text: 'Moldes 1365 @Juan', customerNumber: '', address: 'Moldes 1365', area: '', sellerId: null, channelId: null, unknown: ['@Juan'] },
    ], (a) => (a === 'Moldes 1365' ? 'Puntera nueva' : ''))
    expect(rows[0]).toMatchObject({ customerNumber: '564', address: 'Lacroze 3265', area: 'Belgrano', sellerId: 1, channel: '10', sellerName: '' })
    expect(rows[1]).toMatchObject({ sellerId: null, sellerName: 'Juan', channel: '', task: 'Puntera nueva' })
  })
  it('two equal lines are two rows with different keys', () => {
    const l = { text: 'Moldes 1365', customerNumber: '', address: 'Moldes 1365', area: '', sellerId: null, channelId: null, unknown: [] }
    const [a, b] = rowsFromLines([l, l])
    expect(a?.key).not.toBe(b?.key)
  })
})

describe('the channel a text names', () => {
  it('as a whole word, also in plural, case and accents aside', () => {
    expect(channelIn('KIOSCO EL SOL', channels)?.id).toBe(10)
    expect(channelIn('Autoservicios zona norte', channels)?.id).toBe(11)
    expect(channelIn('Kioscolandia', channels)).toBeNull()
  })
  it('none when two channels are named', () => {
    expect(channelIn('Kiosco y autoservicio', channels)).toBeNull()
  })
})

describe('rows from a capture read by AI', () => {
  const capture = {
    title: 'RUTA AGUSTIN',
    headers: ['CLIENTE', 'NOMBRE', 'DOMICILIO', 'LOCALIDAD', 'VENDEDOR', 'CANAL'],
    rows: [
      ['564', 'EL SOL', 'AV. LACROZE 3265', 'BELGRANO', 'MIRKO RA.', 'KIOSCO'],
      ['620', 'DON PEPE', 'MOLDES 1365', 'BELGRANO', 'JUAN PEREZ', '2. AUTOSERVICIO'],
      ['', '', '', '', '', ''],
    ],
    unreadable: 0,
  }
  it('each row with its parts; known sellers matched, unknown ones kept by name; channels from their column', () => {
    const rows = rowsFromTranscript(capture, sellers, channels)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ customerNumber: '564', address: 'Av. Lacroze 3265', sellerId: 1, sellerName: '', channel: '10' })
    expect(rows[1]).toMatchObject({ customerNumber: '620', sellerId: null, sellerName: 'Juan Perez', channel: '11' })
  })
  it('without a channel column: from the store name, or the list title for all', () => {
    const noColumn = { ...capture, headers: ['CLIENTE', 'NOMBRE', 'DOMICILIO'], rows: [['1', 'KIOSCO EL SOL', 'CABILDO 2245'], ['2', 'DON PEPE', 'MOLDES 1365']] }
    expect(rowsFromTranscript(noColumn, sellers, channels).map((r) => r.channel)).toEqual(['10', ''])
    const titled = { ...noColumn, title: 'MAYORISTAS ZONA NORTE' }
    expect(rowsFromTranscript(titled, sellers, channels).map((r) => r.channel)).toEqual(['10', '12'])
  })
})

describe('sellers to create', () => {
  const rows = [row({ key: 'a', sellerName: 'Juan Perez' }), row({ key: 'b', sellerName: 'JUAN PÉREZ' }), row({ key: 'c', sellerId: 1 }), row({ key: 'd', sellerName: 'Ana' })]
  it('grouped by name, with how many stores each', () => {
    expect(unknownSellers(rows)).toEqual([{ name: 'Juan Perez', count: 2 }, { name: 'Ana', count: 1 }])
  })
  it('once created, every row that named them gets them', () => {
    const done = assignSeller(rows, 'juan pérez', 7)
    expect(done.map((r) => r.sellerId)).toEqual([7, 7, 1, null])
    expect(unknownSellers(done)).toEqual([{ name: 'Ana', count: 1 }])
  })
})

describe('a row ready to add', () => {
  it('needs an address (or a customer number) and, if the company has channels, a channel or "Sin canal"', () => {
    expect(rowProblem(row({ address: '' }), true)).toBe('Falta la dirección')
    expect(rowProblem(row({ address: '', customerNumber: '564', channel: 'none' }), true)).toBeNull()
    expect(rowProblem(row(), true)).toBe('Elegí el canal')
    expect(rowProblem(row(), false)).toBeNull()
    expect(rowProblem(row({ channel: 'none' }), true)).toBeNull()
  })
})

describe('going back to paste more', () => {
  it('keeps the edited rows and leaves the removed ones out', () => {
    const fresh = [row({ key: 'a' }), row({ key: 'b' }), row({ key: 'c' })]
    const before = [row({ key: 'a', area: 'Belgrano' })]
    expect(keepEdits(fresh, before, new Set(['b'])).map((r) => [r.key, r.area])).toEqual([['a', 'Belgrano'], ['c', '']])
  })
})

describe('rows that are directory stores', () => {
  const callao = { id: 's1', name: 'Autoservicio Lili', address: 'Av. Callao 2000', area: 'Balvanera', customerNumber: null, channelId: 11, sellerId: 2, by: 'address' as const }
  it('take the store, with its channel and seller where the row said none, and need nothing more', () => {
    const [r] = applyKnown([row({ key: 'a', address: 'Callao 2000', customerNumber: '9320', sellerName: 'Juan' })], new Map([['a', callao]]))
    expect(r).toMatchObject({ known: callao, channel: '11', sellerId: 2, sellerName: '' })
    expect(r && rowProblem(r, true)).toBeNull()
  })
  it('keep what the row chose', () => {
    const [r] = applyKnown([row({ key: 'a', channel: '10', sellerId: 1 })], new Map([['a', callao]]))
    expect(r).toMatchObject({ channel: '10', sellerId: 1 })
  })
  it('a row that no longer matches is a new store again', () => {
    const [r] = applyKnown([row({ key: 'a', known: callao })], new Map())
    expect(r?.known).toBeUndefined()
  })
})
