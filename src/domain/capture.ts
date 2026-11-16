// A capture (a photo or screenshot of the routing list) is transcribed by AI: the title,
// the column titles and the cells, copied as they are. The AI decides nothing: what each
// column holds is guessed here, with the same rules as a spreadsheet, so nothing the
// capture does not show can reach the import.
import { guessMapping, normalize } from './import-columns'
import type { ImportField, Table } from './import'

export interface Transcript {
  /** A title above the list ("RUTA AGUSTIN"), as written. */
  title: string
  /** Column titles, or labels of a card ("DOMICILIO", "COD"); empty when none are visible. */
  headers: string[]
  rows: string[][]
  /** Rows the AI saw but could not read. */
  unreadable: number
}

const clean = (s: unknown) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '')

/** "RUTA AGUSTIN", "Repositor: Lucía": the merchandiser every row is for. */
export function titleMerchandiser(title: string): string {
  const m = /^(?:ruta|recorrido|repositor|activador)\s*:?\s+(?!de\b)([a-záéíóúñ]+(?: [a-záéíóúñ]+)?)$/i.exec(clean(title))
  return m?.[1] ?? ''
}

/**
 * The transcript as a table to import, with what each column holds. A sales route
 * ("ALMAGRO 1", also in a list without titles) is kept as its neighbourhood; a title naming the merchandiser adds that
 * column when the list has none.
 */
export function transcriptToTable(t: Transcript): { table: Table; hasHeader: boolean; columns: ImportField[] } {
  const headers = t.headers.map(clean)
  const rows = t.rows.map((r) => r.map(clean)).filter((r) => r.some(Boolean))
  const width = Math.max(headers.length, ...rows.map((r) => r.length), 0)
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => r[i] ?? '')
  const hasHeader = headers.some(Boolean)
  let table: Table = hasHeader ? [pad(headers), ...rows.map(pad)] : rows.map(pad)
  let columns = guessMapping(table, hasHeader)

  const area = columns.indexOf('area')
  if (area >= 0 && (!hasHeader || /\bruta\b/.test(normalize(headers[area] ?? '')))) {
    table = table.map((r, i) => (hasHeader && i === 0 ? r : r.map((c, j) => (j === area ? c.replace(/\s+\d{1,2}$/, '') : c))))
  }

  const merchandiser = titleMerchandiser(t.title)
  if (merchandiser && !columns.includes('merchandiser')) {
    table = table.map((r, i) => [...r, hasHeader && i === 0 ? 'Activador' : merchandiser])
    columns = [...columns, 'merchandiser']
  }
  return { table, hasHeader, columns }
}
