import { describe, expect, it } from 'vitest'
import { captureToTable } from './capture'
import { toRows } from './import'

describe('a capture read by AI', () => {
  const read = [
    { customer_number: '12345', name: 'Mas Ahorro', address: ' Tres Arroyos  762 ', area: 'Paternal', merchandiser: 'Agus', task: '' },
    { customer_number: '', name: '', address: 'Amenábar 1260', area: 'Belgrano', merchandiser: 'Lucía', task: 'Armar puntera' },
    { customer_number: '', name: 'TOTAL', address: '', area: '', merchandiser: '', task: '' },
  ]

  it('becomes a table with titles; empty columns and rows without a place are left out', () => {
    const { table, columns } = captureToTable(read)
    expect(columns).toEqual(['customer_number', 'name', 'address', 'area', 'merchandiser', 'task'])
    expect(table).toHaveLength(3)
    expect(table[1]).toEqual(['12345', 'Mas Ahorro', 'Tres Arroyos 762', 'Paternal', 'Agus', ''])
    expect(captureToTable([{ address: 'Moldes 1365' }]).columns).toEqual(['address'])
  })

  it('reads like any imported sheet', () => {
    const { table, columns } = captureToTable(read)
    expect(toRows(table, columns, true)).toMatchObject([
      { line: 2, customerNumber: '12345', address: 'Tres Arroyos 762', merchandiser: 'Agus' },
      { line: 3, address: 'Amenábar 1260', area: 'Belgrano', task: 'Armar puntera' },
    ])
  })

  it('nothing readable', () => {
    expect(captureToTable([])).toEqual({ table: [[]], columns: [] })
  })
})
