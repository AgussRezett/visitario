import { describe, expect, it } from 'vitest'
import { captureSlices, mergeTranscripts, titleMerchandiser, transcriptToLines, transcriptToTable, type Transcript } from './capture'
import { toRows } from './import'

const read = (t: Partial<Transcript>) => transcriptToTable({ title: '', headers: [], rows: [], unreadable: 0, ...t })
const rowsOf = (t: Partial<Transcript>) => {
  const { table, columns, hasHeader } = read(t)
  return toRows(table, columns, hasHeader)
}

describe('a capture transcribed by AI', () => {
  it('a spreadsheet with titles: the app decides what each column is', () => {
    const t = {
      headers: ['CLIENTE', 'VENDEDOR', 'DIRECCION', 'DIA DE VISITA', 'BARRIO'],
      rows: [['101', 'ANA GA.', 'CUENCA 100', 'LUNES', 'BELGRANO'], ['102', 'LEO PI.', ' AV. MONROE  200 ', 'MARTES', 'COGHLAN']],
    }
    expect(read(t).columns).toEqual(['customer_number', 'seller', 'address', 'ignore', 'area'])
    expect(rowsOf(t)[1]).toMatchObject({ line: 3, customerNumber: '102', seller: 'LEO PI.', address: 'Av. Monroe 200', area: 'Coghlan' })
  })

  it('a sales route keeps only its neighbourhood', () => {
    const t = { headers: ['COD', 'DOMICILIO', 'RUTA DE VENTA', 'VENDEDOR', 'DIA'], rows: [['10', 'MUÑIZ 10', 'ALMAGRO 1', 'ANA GA.', 'MIERCOLES']] }
    expect(rowsOf(t)[0]).toMatchObject({ customerNumber: '10', address: 'Muñiz 10', area: 'Almagro', seller: 'ANA GA.' })
  })

  it('a card of labels and values, with empty labels left empty', () => {
    const t = { headers: ['DOMICILIO', 'COD', 'RUTA DE VENTA', 'CIUDAD/PARTIDO'], rows: [['CONDE 700', '3300', '', '']] }
    expect(rowsOf(t)).toEqual([expect.objectContaining({ customerNumber: '3300', address: 'Conde 700', area: '' })])
  })

  it('without titles, from the content; nothing is filled in that the capture does not show', () => {
    const t = {
      rows: [
        ['ANA GA.', 'CUENCA 100', 'VIERNES', 'VILLA DEVOTO'],
        ['LEO PI.', 'HABANA 200', 'VIERNES', 'VILLA DEVOTO'],
        ['ANA GA.', 'BARZANA 300', 'VIERNES', 'VILLA URQUIZA'],
        ['LEO PI.', 'MONROE 400', 'VIERNES', 'VILLA URQUIZA'],
      ],
    }
    const rows = rowsOf(t)
    expect(read(t)).toMatchObject({ hasHeader: false, columns: ['seller', 'address', 'ignore', 'area'] })
    expect(rows).toHaveLength(4)
    expect(rows[0]).toMatchObject({ line: 1, customerNumber: '', name: '', seller: 'ANA GA.', address: 'Cuenca 100', area: 'Villa Devoto', merchandiser: '' })
  })

  it('a made-up title gives way to what the column plainly holds', () => {
    // A model wrote "NOMBRE" over the sellers of a list that had no titles.
    const t = { headers: ['NOMBRE', 'DIRECCIÓN', 'DÍA', 'BARRIO'], rows: [['ANA GA.', 'CUENCA 100', 'VIERNES', 'VILLA DEVOTO'], ['LEO PI.', 'HABANA 200', 'VIERNES', 'VILLA DEVOTO']] }
    expect(read(t).columns).toEqual(['seller', 'address', 'ignore', 'area'])
    expect(rowsOf(t)[0]).toMatchObject({ name: '', seller: 'ANA GA.', address: 'Cuenca 100' })
  })

  it('without titles, a sales route column is its neighbourhood too', () => {
    const rows = [['10', 'BULNES 100', 'PALERMO 6', 'ANA GA.', 'MIERCOLES'], ['11', 'JUNCAL 200', 'PALERMO 6', 'ANA GA.', 'MIERCOLES'], ['12', 'CABELLO 300', 'PALERMO 6', 'ANA GA.', 'MIERCOLES']]
    expect(read({ rows }).columns).toEqual(['customer_number', 'address', 'area', 'seller', 'ignore'])
    expect(rowsOf({ rows }).map((r) => r.area)).toEqual(['Palermo', 'Palermo', 'Palermo'])
    expect(rowsOf({ rows })[2]).toMatchObject({ customerNumber: '12', address: 'Cabello 300', seller: 'ANA GA.' })
  })

  it('a title naming the merchandiser assigns every row', () => {
    expect(titleMerchandiser('RUTA AGUSTIN')).toBe('AGUSTIN')
    expect(titleMerchandiser('Repositor: Lucía')).toBe('Lucía')
    expect(titleMerchandiser('RUTA DE VENTA')).toBe('')
    expect(titleMerchandiser('Lista del lunes')).toBe('')
    const t = { title: 'RUTA AGUSTIN', headers: ['CADENA', 'PDVID', 'DIRECCIÓN', 'VENDEDOR'], rows: [['KIOSCO SUR', '10001', 'LARREA 100', 'ANA GA.']] }
    expect(read(t).columns).toEqual(['name', 'customer_number', 'address', 'seller', 'merchandiser'])
    expect(rowsOf(t)[0]).toMatchObject({ name: 'Kiosco Sur', customerNumber: '10001', address: 'Larrea 100', merchandiser: 'AGUSTIN' })
  })

  it('as lines to paste into a day: sellers only when the catalog has them', () => {
    const t = {
      title: '',
      unreadable: 0,
      headers: ['COD', 'DOMICILIO', 'RUTA DE VENTA', 'VENDEDOR', 'DIA'],
      rows: [['10', 'MUÑIZ 10', 'ALMAGRO 1', 'ANA GA.', 'MIERCOLES'], ['', 'CASTRO 20', 'ALMAGRO 1', 'NADIE NA.', 'MIERCOLES'], ['30', '', '', '', '']],
    }
    expect(transcriptToLines(t, [{ id: 1, name: 'Ana Ga' }])).toEqual(['10; Muñiz 10; Almagro @Ana Ga', 'Castro 20; Almagro', '30'])
    expect(transcriptToLines({ title: '', headers: [], rows: [], unreadable: 2 }, [])).toEqual([])
  })

  it('empty rows are dropped; nothing readable is an empty table', () => {
    expect(read({ headers: ['DOMICILIO'], rows: [['', ''], ['MOLDES 1365']] }).table).toEqual([['DOMICILIO'], ['MOLDES 1365']])
    expect(read({})).toEqual({ table: [], hasHeader: false, columns: [] })
  })
})

describe('several captures of one list', () => {
  const t = (headers: string[], rows: string[][], title = '', unreadable = 0) => ({ title, headers, rows, unreadable })
  it('the same columns go one after the other; different lists do not merge', () => {
    expect(mergeTranscripts([t(['COD', 'DOMICILIO'], [['1', 'A 100']], 'RUTA ANA', 1), t(['cod', 'domicilio'], [['2', 'B 200']], 'RUTA ANA')]))
      .toEqual(t(['COD', 'DOMICILIO'], [['1', 'A 100'], ['2', 'B 200']], 'RUTA ANA', 1))
    expect(mergeTranscripts([t(['COD'], [['1']], 'RUTA ANA'), t(['COD'], [['2']], 'RUTA LEO')])?.title).toBe('')
    expect(mergeTranscripts([t(['COD', 'DOMICILIO'], []), t(['DIRECCION'], [])])).toBeNull()
    expect(mergeTranscripts([])).toBeNull()
  })
})

describe('a long capture is read in slices', () => {
  it('a usual screenshot goes whole; a tall one in overlapping slices that cover it all', () => {
    expect(captureSlices(1080, 2400)).toEqual([{ top: 0, height: 2400 }]) // a phone screen, 20:9
    expect(captureSlices(1080, 2800)).toEqual([{ top: 0, height: 2800 }])
    const s = captureSlices(1080, 6000)
    expect(s.length).toBe(4)
    expect(s[0]?.top).toBe(0)
    expect((s.at(-1)?.top ?? 0) + (s.at(-1)?.height ?? 0)).toBe(6000)
    // Each slice starts before the previous one ends: no row is cut in two.
    s.slice(1).forEach((x, i) => expect(x.top).toBeLessThan((s[i]?.top ?? 0) + (s[i]?.height ?? 0)))
    expect(captureSlices(1000, 20000).length).toBe(4)
  })
})
