import { describe, expect, it } from 'vitest'
import { briefLines, pagesText, stopTask, understandBrief, type BriefCatalog } from './brief'

// A deck like the ones that arrive: a cover, then a slide (or two) per store.
const PAGES = [
  'LOCALES DE VISITA PALERMO',
  'Gorriti 4100 #120 03/11',
  'Gorriti 4100 #120 03/11',
  'Honduras 3900 #4471 03/11',
  'Av. Santa Fe 3200 #118 03/11',
]
const cat: BriefCatalog = {
  sellers: [{ id: 1, name: 'Ana Lo' }, { id: 2, name: 'Beto Su' }],
  people: [{ personId: 'p1', firstName: 'Lucía', lastName: 'Gómez' }],
}
const TODAY = '2026-11-16'

describe('visits from a PDF and written indications', () => {
  it('keeps the PDF order and one stop per store, with its pages and seller', () => {
    const b = understandBrief({
      stops: [
        { page: 5, address: 'Av. Santa Fe 3200', ref: '#118', seller_id: 2 },
        { page: 2, address: 'Gorriti 4100', ref: '#120', seller_id: 1 },
        { page: 3, address: 'Gorriti 4100', ref: '120', seller_id: 1 },
        { page: 4, address: 'Honduras 3900', ref: '#4471', seller_id: 1 },
      ],
      task: 'Avisar si falta algo y ordenar como en el PDF', date: '2026-11-17', merchandiser: 'lucia',
    }, PAGES, cat, TODAY)
    expect(b.stops).toEqual([
      { address: 'Gorriti 4100', ref: '#120', pages: [2, 3], sellerId: 1 },
      { address: 'Honduras 3900', ref: '#4471', pages: [4], sellerId: 1 },
      { address: 'Av. Santa Fe 3200', ref: '#118', pages: [5], sellerId: 2 },
    ])
    expect(b).toMatchObject({ date: '2026-11-17', personId: 'p1', dropped: 0, unknown: [] })
    expect(b.chips).toEqual(['3 locales, en el orden del PDF', 'Ana Lo: 2', 'Beto Su: 1', 'Para: Lucía Gómez', 'Día: martes 17 de noviembre'])
  })

  it('nothing the PDF or the lists do not have gets through', () => {
    const b = understandBrief({
      stops: [
        { page: 2, address: 'Gorriti 4150', ref: '#120', seller_id: 1 },
        { page: 9, address: 'Honduras 3900' },
        { page: 4, address: 'Honduras 3900', ref: '#999', seller_id: 77 },
      ],
      date: '2026-11-01', merchandiser: 'Pedro', unknown: ['vendedor Carla'],
    }, PAGES, cat, TODAY)
    expect(b.stops).toEqual([{ address: 'Honduras 3900', ref: '', pages: [4], sellerId: null }])
    expect(b).toMatchObject({ dropped: 2, date: null, personId: null, task: '' })
    expect(b.unknown).toEqual(['vendedor Carla', 'el activador "Pedro"'])
  })

  it('an answer that is not one is nothing', () => {
    expect(understandBrief(null, PAGES, cat, TODAY)).toMatchObject({ stops: [], dropped: 0 })
    expect(understandBrief({ stops: 'x' }, PAGES, cat, TODAY).stops).toEqual([])
  })

  it('each store says where to look in the PDF', () => {
    const stop = { address: 'Gorriti 4100', ref: '#120', pages: [2, 3], sellerId: 1 }
    expect(pagesText([4])).toBe('pág. 4')
    expect(pagesText([2, 3, 4])).toBe('págs. 2, 3 y 4')
    expect(stopTask('Avisar si falta algo', stop)).toBe('Avisar si falta algo · PDF págs. 2 y 3 · #120')
    expect(stopTask('', { ...stop, ref: '', pages: [4] })).toBe('PDF pág. 4')
    const b = understandBrief({ stops: [{ page: 2, address: 'Gorriti 4100', seller_id: 1 }, { page: 4, address: 'Honduras 3900' }], task: 'Reponer' }, PAGES, cat, TODAY)
    expect(briefLines(b, cat.sellers)).toEqual([
      { text: 'Gorriti 4100 @Ana Lo', task: 'Reponer · PDF pág. 2' },
      { text: 'Honduras 3900', task: 'Reponer · PDF pág. 4' },
    ])
  })
})
