/**
 * Importing a day from a spreadsheet or pasted text: reading the table, guessing what each
 * column holds, recognising the saved format, telling who each row is for and what still
 * needs a look. Pure rules; the screens and the database call live in features/import.
 */

export type ImportField = 'customer_number' | 'name' | 'address' | 'area' | 'merchandiser' | 'task' | 'ignore'

export const FIELD_LABELS: Record<ImportField, string> = {
  customer_number: 'Nro. de cliente',
  name: 'Nombre del comercio',
  address: 'Dirección',
  area: 'Zona',
  merchandiser: 'Activador',
  task: 'Tarea',
  ignore: 'Ignorar',
}

export type Table = string[][]

/** What gets saved as a format ("Panda diaria"). */
export interface ImportMapping {
  hasHeader: boolean
  columns: ImportField[]
  scope: 'caba' | 'argentina'
  /** Names in the spreadsheet confirmed as a person: normalized name → person id. */
  aliases: Record<string, string>
}

export interface ImportRow {
  /** Row number as the supervisor sees it in the spreadsheet (1-based, titles included). */
  line: number
  customerNumber: string
  name: string
  address: string
  area: string
  merchandiser: string
  task: string
}

export interface Person {
  id: string
  firstName: string
  lastName: string
}

/** Same as private.normalize in the database: lower case, no accents or punctuation. */
export const normalize = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** A spreadsheet cell as text (customer numbers often come as numbers). */
export function cellText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'number') return String(value)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).replace(/\s+/g, ' ').trim()
}

/** Cells as text, without empty rows or trailing empty columns, every row the same width. */
export function cleanTable(rows: unknown[][]): Table {
  const text = rows.map((r) => r.map(cellText)).filter((r) => r.some(Boolean))
  const width = Math.max(0, ...text.map((r) => r.reduce((w, c, i) => (c ? i + 1 : w), 0)))
  return text.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''))
}

/** CSV or text copied from a spreadsheet; quotes allowed. The separator is guessed from the first line. */
export function parseDelimited(text: string, separators = ['\t', ';', ',']): Table {
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const sep = separators.find((s) => first.includes(s)) ?? separators[0]
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === sep) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  row.push(cell)
  rows.push(row)
  return cleanTable(rows)
}

/** Pasted text: one address per line, or columns when copied from a spreadsheet (tabs or ;). */
export function parsePasted(text: string): { kind: 'lines'; lines: string[] } | { kind: 'table'; table: Table } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const withColumns = lines.filter((l) => l.includes('\t') || l.includes(';')).length
  if (lines.length && withColumns >= Math.ceil(lines.length / 2)) return { kind: 'table', table: parseDelimited(text, ['\t', ';']) }
  return { kind: 'lines', lines: lines.filter((l) => l.length >= 3) }
}

const KEYWORDS: [ImportField, RegExp][] = [
  ['merchandiser', /\b(repositor|activador|promotor|merchandiser|repo|responsable)\b/],
  ['customer_number', /\b(nro|numero|cod|codigo|id)\b|n°|^(cliente|cuenta|nro cliente)$/],
  ['address', /\b(direccion|domicilio|calle|dir|ubicacion)\b/],
  ['area', /\b(localidad|barrio|zona|partido|ciudad)\b/],
  ['name', /\b(razon social|nombre|comercio|local|fantasia|pdv|punto de venta)\b/],
  ['task', /\b(tarea|accion|observacion|observaciones|actividad|que hacer)\b/],
]

const isNumber = (s: string) => /^\d{2,12}$/.test(s)
const isAddress = (s: string) => /[a-zñ].*\s\d{1,5}\b/i.test(s)

/** What a column holds, from its title, else from what is in it. */
export function guessField(header: string, samples: string[]): ImportField {
  const h = normalize(header)
  if (h) for (const [field, re] of KEYWORDS) if (re.test(h)) return field
  const filled = samples.filter(Boolean)
  if (!filled.length) return 'ignore'
  const share = (test: (s: string) => boolean) => filled.filter(test).length / filled.length
  if (share(isAddress) >= 0.6) return 'address'
  if (share(isNumber) >= 0.8) return 'customer_number'
  return 'ignore'
}

/** Titles in the first row: a title names a known field, or the row has no numbers where the next one does. */
export function looksLikeHeader(table: Table): boolean {
  const [first, second] = table
  if (!first) return false
  if (first.some((c) => KEYWORDS.some(([, re]) => re.test(normalize(c))))) return true
  const hasDigits = (r: string[]) => r.some((c) => /\d/.test(c))
  return Boolean(second) && !hasDigits(first) && hasDigits(second ?? [])
}

/** One field per column; a field already taken by a column to the left stays ignored. */
export function guessMapping(table: Table, hasHeader: boolean): ImportField[] {
  const width = table[0]?.length ?? 0
  const body = (hasHeader ? table.slice(1) : table).slice(0, 30)
  const used = new Set<ImportField>()
  return Array.from({ length: width }, (_, i) => {
    const field = guessField(hasHeader ? (table[0]?.[i] ?? '') : '', body.map((r) => r[i] ?? ''))
    if (field === 'ignore' || used.has(field)) return 'ignore'
    used.add(field)
    return field
  })
}

/** Recognises the same spreadsheet next time: its column titles, normalized. */
export const signatureOf = (headers: string[]) => headers.map(normalize).join('|').slice(0, 500)

/** Rows to import: those with an address or a customer number. */
export function toRows(table: Table, columns: ImportField[], hasHeader: boolean): ImportRow[] {
  const pick = (r: string[], field: ImportField) => {
    const i = columns.indexOf(field)
    return i >= 0 ? (r[i] ?? '').trim() : ''
  }
  return table
    .map((r, i) => ({
      line: i + 1,
      customerNumber: pick(r, 'customer_number'),
      name: pick(r, 'name'),
      address: pick(r, 'address'),
      area: pick(r, 'area'),
      merchandiser: pick(r, 'merchandiser'),
      task: pick(r, 'task'),
    }))
    .slice(hasHeader ? 1 : 0)
    .filter((r) => r.address || r.customerNumber)
}

export const linesToRows = (lines: string[]): ImportRow[] =>
  lines.map((address, i) => ({ line: i + 1, customerNumber: '', name: '', address, area: '', merchandiser: '', task: '' }))

export type PersonMatch = { kind: 'sure' | 'guess'; person: Person } | { kind: 'none' }

function distance(a: string, b: string) {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min((row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, (row[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    row = next
  }
  return row[b.length] ?? 0
}

/**
 * Who a name in the spreadsheet is. Sure: a confirmed alias, the full name, or a first name
 * (or its start, like "Agus") nobody else on the team has. Guess, to confirm: "Nico F.",
 * "Gómez", a typo.
 */
export function matchPerson(raw: string, people: Person[], aliases: Record<string, string> = {}): PersonMatch {
  const n = normalize(raw)
  if (!n) return { kind: 'none' }
  const one = (list: Person[], kind: 'sure' | 'guess'): PersonMatch | null => (list.length === 1 && list[0] ? { kind, person: list[0] } : null)
  const first = (p: Person) => normalize(p.firstName)
  const last = (p: Person) => normalize(p.lastName)
  const aliased = people.find((p) => p.id === aliases[n])
  if (aliased) return { kind: 'sure', person: aliased }
  const [a = '', b = ''] = n.split(' ')
  const exact =
    one(people.filter((p) => `${first(p)} ${last(p)}` === n), 'sure') ??
    one(people.filter((p) => first(p) === n), 'sure') ??
    (!b && a.length >= 4 ? one(people.filter((p) => first(p).startsWith(a)), 'sure') : null) // "Agus", "Vale"
  if (exact) return exact
  if (people.filter((p) => first(p) === n).length > 1) return { kind: 'none' } // two people with that name
  return (
    (b ? one(people.filter((p) => first(p).startsWith(a) && last(p).startsWith(b)), 'guess') : null) ??
    one(people.filter((p) => last(p) === n), 'guess') ??
    (a.length === 3 ? one(people.filter((p) => first(p).startsWith(a)), 'guess') : null) ??
    (a.length >= 4 ? one(people.filter((p) => distance(first(p), a) <= 1), 'guess') : null) ?? { kind: 'none' }
  )
}

export interface StoreMatch {
  storeId: string
  name: string | null
  address: string
  area: string | null
  customerNumber: string | null
  matchedBy: 'customer' | 'address'
}

export type RowStatus = 'recognized' | 'new' | 'review'

/** Where a row stands before saving, and why it needs a look. */
export function classify(row: ImportRow, match: StoreMatch | undefined, person: Person | null): { status: RowStatus; reason?: string } {
  if (!person) return { status: 'review', reason: row.merchandiser ? `"${row.merchandiser}" no es nadie del equipo` : 'Falta elegir el activador' }
  if (match) return { status: 'recognized' }
  if (row.address.length < 3) return { status: 'review', reason: `El cliente ${row.customerNumber} no está en el directorio y no tiene dirección` }
  return { status: 'new' }
}
