import { describe, expect, it } from 'vitest'
import { briefLines, briefPages, stopTask, taskKey, transcriptText, understandBrief, whereText, type BriefCatalog } from './brief'

// A deck like the ones that arrive (made up): a cover, then a slide or two per store; and a capture.
const DECK = ['LOCALES DE VISITA PALERMO', 'Gorriti 4100 #120 03/11', 'Gorriti 4100 #120 03/11', 'Honduras 3900 #4471 03/11', 'Av. Santa Fe 3200 #118 03/11']
const CAPTURE = transcriptText({ title: 'RUTA ANA', headers: ['Cliente', 'Dirección', 'Barrio'], rows: [['564', 'Thames 1500', 'Palermo']], unreadable: 0 })
const PAGES = briefPages([{ kind: 'pdf', pages: DECK }, { kind: 'image', pages: [CAPTURE] }])
const cat: BriefCatalog = {
  sellers: [{ id: 1, name: 'Ana Lo' }, { id: 2, name: 'Beto Su' }],
  people: [{ personId: 'p1', firstName: 'Lucía', lastName: 'Gómez' }],
}
const TODAY = '2026-11-16'

describe('visits from files and written indications', () => {
  it('names every page so a person can find it', () => {
    expect(PAGES.map((p) => p.label)).toEqual(['PDF pág. 1', 'PDF pág. 2', 'PDF pág. 3', 'PDF pág. 4', 'PDF pág. 5', 'la captura'])
    expect(CAPTURE).toBe('RUTA ANA\nCliente | Dirección | Barrio\n564 | Thames 1500 | Palermo')
    const two = briefPages([{ kind: 'pdf', pages: ['a'] }, { kind: 'image', pages: ['b'] }, { kind: 'pdf', pages: ['c', 'd'] }, { kind: 'image', pages: ['e'] }])
    expect(two.map((p) => p.label)).toEqual(['PDF 1 pág. 1', 'captura 1', 'PDF 2 pág. 1', 'PDF 2 pág. 2', 'captura 2'])
    expect(whereText(['PDF pág. 2', 'PDF pág. 3'])).toBe('PDF págs. 2 y 3')
    expect(whereText(['PDF 1 pág. 4', 'PDF 2 pág. 1'])).toBe('PDF 1 pág. 4 y PDF 2 pág. 1')
    expect(whereText([])).toBe('')
  })

  it('keeps the files order and one stop per store, with its pages, number and seller', () => {
    const b = understandBrief({
      stops: [
        { page: 6, address: 'Thames 1500', customer_number: '564', area: 'Palermo', seller_id: 1 },
        { page: 5, address: 'Av. Santa Fe 3200', ref: '#118', seller_id: 2 },
        { page: 2, address: 'Gorriti 4100', ref: '#120', seller_id: 1 },
        { page: 3, address: 'Gorriti 4100', ref: '120', seller_id: 1 },
        { page: 4, address: 'Honduras 3900', ref: '#4471', seller_id: 1 },
      ],
      task: 'Avisar si falta algo y ordenar como en el PDF', date: '2026-11-17', merchandiser: 'lucia',
    }, PAGES, cat, TODAY)
    // The deck's "#120" is the client number, as a capture's column is.
    expect(b.stops.map((s) => [s.address, s.customerNumber, s.area, s.where, s.sellerId])).toEqual([
      ['Gorriti 4100', '120', '', 'PDF págs. 2 y 3', 1],
      ['Honduras 3900', '4471', '', 'PDF pág. 4', 1],
      ['Av. Santa Fe 3200', '118', '', 'PDF pág. 5', 2],
      ['Thames 1500', '564', 'Palermo', '', 1],
    ])
    expect(b).toMatchObject({ date: '2026-11-17', personId: 'p1', dropped: 0, unknown: [], conflicts: [] })
    expect(b.chips).toEqual(['4 locales, en el orden de los archivos', 'Ana Lo: 3', 'Beto Su: 1', 'Para: Lucía Gómez', 'Día: martes 17 de noviembre'])
  })

  it('nothing the files or the lists do not have gets through', () => {
    const b = understandBrief({
      stops: [
        { page: 2, address: 'Gorriti 4150', ref: '#120', seller_id: 1 },
        { page: 9, address: 'Honduras 3900' },
        { page: 4, address: 'Honduras 3900', ref: '#999', customer_number: '777', area: 'Belgrano', seller_id: 77 },
      ],
      date: '2026-11-01', merchandiser: 'Pedro', unknown: ['vendedor Carla'],
    }, PAGES, cat, TODAY)
    expect(b.stops).toEqual([{ address: 'Honduras 3900', customerNumber: '', area: '', pages: [4], where: 'PDF pág. 4', sellerId: null }])
    expect(b).toMatchObject({ dropped: 2, date: null, personId: null, task: '' })
    expect(b.unknown).toEqual(['vendedor Carla', 'el activador "Pedro"'])
  })

  it('one number, one store: a number repeated on another address stays on the first and is said', () => {
    const pages = briefPages([{ kind: 'pdf', pages: ['Cabildo 1236 #551', 'Olaguer y Feliu 2439 #551'] }])
    const b = understandBrief({ stops: [{ page: 2, address: 'Olaguer y Feliu 2439', customer_number: '#551' }, { page: 1, address: 'Cabildo 1236', customer_number: '551' }] }, pages, cat, TODAY)
    expect(b.stops.map((s) => [s.address, s.customerNumber])).toEqual([['Cabildo 1236', '551'], ['Olaguer y Feliu 2439', '']])
    expect(b.conflicts).toEqual(['#551 en Olaguer y Feliu 2439 (también está en Cabildo 1236)'])
  })

  it('an answer that is not one is nothing', () => {
    expect(understandBrief(null, PAGES, cat, TODAY)).toMatchObject({ stops: [], dropped: 0 })
    expect(understandBrief({ stops: 'x' }, PAGES, cat, TODAY).stops).toEqual([])
  })

  it('each store says what to do and where to look; the list keeps number, area and seller', () => {
    const b = understandBrief({
      stops: [{ page: 2, address: 'Gorriti 4100', ref: '#120', seller_id: 1 }, { page: 6, address: 'Thames 1500', customer_number: 564, area: 'Palermo' }],
      task: 'Reponer',
    }, PAGES, cat, TODAY)
    const [, capture] = b.stops
    expect(capture && stopTask('', capture)).toBe('')
    expect(briefLines(b, cat.sellers)).toEqual([
      { text: '120; Gorriti 4100 @Ana Lo', key: 'gorriti 4100', task: 'Reponer · PDF pág. 2' },
      { text: '564; Thames 1500; Palermo', key: 'thames 1500', task: 'Reponer' },
    ])
    // The task follows the address, even with the line fixed by hand.
    expect(taskKey('Av. Gorriti 4100')).toBe(taskKey('Gorriti 4100'))
  })
})
