import { cleanTable, parseDelimited, type Table } from '@/domain/import'

export interface Sheet {
  name: string
  table: Table
}

/** Errors the supervisor can act on, in Spanish. */
export class FileError extends Error {}

const MAX_BYTES = 5 * 1024 * 1024

/** Reads an Excel (.xlsx) or CSV file into its sheets. The Excel reader loads only when needed. */
export async function readSpreadsheet(file: File): Promise<Sheet[]> {
  if (file.size > MAX_BYTES) throw new FileError('El archivo pesa más de 5 MB. Dejá solo la hoja del día y volvé a probar.')
  const name = file.name.toLowerCase()
  if (name.endsWith('.xls')) throw new FileError('Ese formato de Excel es viejo. Abrilo y guardalo como .xlsx o .csv.')
  if (name.endsWith('.csv') || name.endsWith('.txt') || file.type === 'text/csv') {
    return [{ name: file.name, table: parseDelimited(await file.text()) }]
  }
  if (!name.endsWith('.xlsx')) throw new FileError('Subí un archivo de Excel (.xlsx) o CSV.')
  const { default: readXlsxFile } = await import('read-excel-file/browser')
  try {
    const sheets = await readXlsxFile(file)
    return sheets.map((s) => ({ name: s.sheet, table: cleanTable(s.data) })).filter((s) => s.table.length)
  } catch {
    throw new FileError('No pudimos leer ese Excel. Probá guardarlo de nuevo o exportarlo como CSV.')
  }
}
