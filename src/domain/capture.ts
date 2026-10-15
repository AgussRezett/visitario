// A capture (a photo or screenshot of the routing list) read by AI becomes the same
// table the import reviews: fixed columns, already mapped, nothing saved until "Agregar".
import type { ImportField, Table } from './import'

export interface CaptureRow {
  customer_number: string
  name: string
  address: string
  area: string
  merchandiser: string
  task: string
}

export const CAPTURE_COLUMNS: { key: keyof CaptureRow; field: ImportField; title: string }[] = [
  { key: 'customer_number', field: 'customer_number', title: 'Nro. de cliente' },
  { key: 'name', field: 'name', title: 'Nombre' },
  { key: 'address', field: 'address', title: 'Dirección' },
  { key: 'area', field: 'area', title: 'Zona' },
  { key: 'merchandiser', field: 'merchandiser', title: 'Activador' },
  { key: 'task', field: 'task', title: 'Tarea' },
]

const clean = (s: unknown) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '')

/**
 * The rows read from the capture as a table with titles, and the mapping of its columns.
 * Rows without an address or a customer number are dropped: there is nothing to visit.
 * Columns nobody filled are left out of the mapping.
 */
export function captureToTable(rows: readonly Partial<CaptureRow>[]): { table: Table; columns: ImportField[] } {
  const kept = rows
    .map((r) => Object.fromEntries(CAPTURE_COLUMNS.map((c) => [c.key, clean(r[c.key])])) as unknown as CaptureRow)
    .filter((r) => r.address || r.customer_number)
  const used = CAPTURE_COLUMNS.filter((c) => kept.some((r) => r[c.key]))
  return {
    table: [used.map((c) => c.title), ...kept.map((r) => used.map((c) => r[c.key]))],
    columns: used.map((c) => c.field),
  }
}
