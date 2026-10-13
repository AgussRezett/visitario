import { describe, expect, it } from 'vitest'
import {
  classify, cleanTable, guessMapping, linesToRows, looksLikeHeader, matchPerson, normalize, parseDelimited, parsePasted, signatureOf, toRows,
  type ImportRow, type Person,
} from './import'

const panda = [
  ['CLIENTE', 'RAZÓN SOCIAL', 'DOMICILIO', 'LOCALIDAD', 'REPOSITOR', 'VENDEDOR'],
  ['12345', 'Mas Ahorro', 'Tres Arroyos 762', 'Paternal', 'Agus', 'Ramírez'],
  ['20114', 'Super Amenábar', 'Amenábar 1260', 'Belgrano', 'Agus', 'Ramírez'],
  ['20577', 'Autoservicio Lili', 'Moldes 1365', 'Belgrano', 'Valentina', 'Ortiz'],
  ['18802', 'Maxi Juramento', 'Juramento 2101', 'Belgrano', 'Nico F.', 'Ortiz'],
]

const team: [Person, Person, Person, Person, Person] = [
  { id: 'p1', firstName: 'Agustín', lastName: 'Rezett' },
  { id: 'p2', firstName: 'Lucía', lastName: 'Gómez' },
  { id: 'p3', firstName: 'Valentina', lastName: 'Ortiz' },
  { id: 'p4', firstName: 'Nicolás', lastName: 'Ferrari' },
  { id: 'p5', firstName: 'Diego', lastName: 'Paz' },
]

describe('reading the table', () => {
  it('turns cells into text and drops empty rows and trailing columns', () => {
    expect(cleanTable([[12345, ' Mas  Ahorro ', null, ''], [null, null], ['', 'x']])).toEqual([['12345', 'Mas Ahorro'], ['', 'x']])
  })

  it('reads CSV with ; or , and quotes', () => {
    expect(parseDelimited('Cliente;Domicilio\n12345;"Tres Arroyos 762; PB"\r\n20114;Amenábar 1260\n')).toEqual([
      ['Cliente', 'Domicilio'],
      ['12345', 'Tres Arroyos 762; PB'],
      ['20114', 'Amenábar 1260'],
    ])
    expect(parseDelimited('a,b\n"say ""hi""",2')).toEqual([['a', 'b'], ['say "hi"', '2']])
  })

  it('pasted text: one address per line, or columns copied from Excel', () => {
    expect(parsePasted('Amenábar 1260\n\nMoldes 1365, Belgrano\n')).toEqual({ kind: 'lines', lines: ['Amenábar 1260', 'Moldes 1365, Belgrano'] })
    expect(parsePasted('12345\tTres Arroyos 762\n20114\tAmenábar 1260')).toEqual({ kind: 'table', table: [['12345', 'Tres Arroyos 762'], ['20114', 'Amenábar 1260']] })
  })
})

describe('guessing the columns', () => {
  it('knows titles in the first row', () => {
    expect(looksLikeHeader(panda)).toBe(true)
    expect(looksLikeHeader(panda.slice(1))).toBe(false)
  })

  it("maps Panda's spreadsheet from its titles", () => {
    expect(guessMapping(panda, true)).toEqual(['customer_number', 'name', 'address', 'area', 'merchandiser', 'ignore'])
  })

  it('without titles, guesses from the content', () => {
    expect(guessMapping(panda.slice(1), false)).toEqual(['customer_number', 'ignore', 'address', 'ignore', 'ignore', 'ignore'])
  })

  it('a field is used once: the second address column is ignored', () => {
    expect(guessMapping([['Dirección', 'Domicilio'], ['Moldes 1365', 'Moldes 1365']], true)).toEqual(['address', 'ignore'])
  })

  it('the same titles give the same signature, whatever the accents or case', () => {
    expect(signatureOf(panda[0] ?? [])).toBe(signatureOf(['cliente', 'Razon Social', 'domicilio', 'Localidad', 'Repositor', 'Vendedor']))
    expect(normalize('  Olazábal  1.550 ')).toBe('olazabal 1 550')
  })
})

describe('rows', () => {
  it('keeps rows with an address or a customer number, numbered as in the file', () => {
    const rows = toRows([...panda, ['', 'Sin nada', '', '', '', '']], guessMapping(panda, true), true)
    expect(rows).toHaveLength(4)
    expect(rows[0]).toMatchObject({ line: 2, customerNumber: '12345', name: 'Mas Ahorro', address: 'Tres Arroyos 762', area: 'Paternal', merchandiser: 'Agus' })
  })

  it('pasted lines become rows with only the address', () => {
    expect(linesToRows(['Moldes 1365'])).toEqual([{ line: 1, customerNumber: '', name: '', address: 'Moldes 1365', area: '', merchandiser: '', task: '' }])
  })
})

describe('who each row is for', () => {
  it('sure: full name, a first name (or its start) nobody else has, accents aside', () => {
    expect(matchPerson('Lucia', team)).toEqual({ kind: 'sure', person: team[1] })
    expect(matchPerson('Agus', team)).toEqual({ kind: 'sure', person: team[0] })
    expect(matchPerson('VALENTINA ORTIZ', team)).toEqual({ kind: 'sure', person: team[2] })
  })

  it('to confirm: initials, a very short name, the last name or a typo', () => {
    expect(matchPerson('Nico F.', team)).toEqual({ kind: 'guess', person: team[3] })
    expect(matchPerson('Die', team)).toEqual({ kind: 'guess', person: team[4] })
    expect(matchPerson('Gómez', team)).toEqual({ kind: 'guess', person: team[1] })
    expect(matchPerson('Diega', team)).toEqual({ kind: 'guess', person: team[4] })
  })

  it('a confirmed name is sure next time', () => {
    expect(matchPerson('Nico F.', team, { 'nico f': 'p4' })).toEqual({ kind: 'sure', person: team[3] })
  })

  it('nobody, or two people with that name', () => {
    expect(matchPerson('Ramírez', team).kind).toBe('none')
    expect(matchPerson('', team).kind).toBe('none')
    expect(matchPerson('Lucía', [...team, { id: 'p9', firstName: 'Lucía', lastName: 'Paz' }]).kind).toBe('none')
  })
})

describe('before saving', () => {
  const [row] = toRows(panda, guessMapping(panda, true), true) as [ImportRow]
  const match = { storeId: 's1', name: 'Mas Ahorro', address: 'Tres Arroyos 762', area: null, customerNumber: '12345', matchedBy: 'customer' as const }

  it('recognised, new, or to review', () => {
    expect(classify(row, match, team[0]).status).toBe('recognized')
    expect(classify(row, undefined, team[0]).status).toBe('new')
    expect(classify(row, match, null)).toEqual({ status: 'review', reason: '"Agus" no es nadie del equipo' })
    expect(classify({ ...row, address: '' }, undefined, team[0]).status).toBe('review')
  })
})
