/**
 * What each column of an imported table holds: from its title, else from what is in it.
 * The same rules read a spreadsheet, pasted text and a capture transcribed by AI.
 */
import type { ImportField, Table } from './import'

/** Same as private.normalize in the database: lower case, no accents or punctuation. */
export const normalize = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Order matters: the first match wins ("RUTA DE VENTA" is an area, "DÍA DE VISITA" nothing).
const KEYWORDS: [ImportField, RegExp][] = [
  ['ignore', /\b(dia|dias|dia de visita|fecha|frecuencia|semana)\b/],
  ['merchandiser', /\b(repositor|activador|promotor|merchandiser|repo)\b/],
  // In the activation messages the seller is "Responsable".
  ['seller', /\b(vendedor|vendedora|responsable|preventista)\b/],
  ['channel', /\b(canal|tipo de cliente)\b/],
  ['customer_number', /\b(nro|numero|cod|codigo|id|pdvid)\b|n°|^(cliente|cuenta|nro cliente|pdv id)$/],
  ['address', /\b(direccion|domicilio|calle|dir|ubicacion)\b/],
  ['area', /\b(localidad|barrio|zona|partido|ciudad|ruta de venta|ruta)\b/],
  ['name', /\b(razon social|nombre|comercio|local|fantasia|pdv|punto de venta|cadena|cadana)\b/],
  ['task', /\b(tarea|accion|observacion|observaciones|actividad|que hacer)\b/],
]

const WEEKDAYS = /^(lunes|martes|miercoles|jueves|viernes|sabado|domingo)$/

export const isNumber = (s: string) => /^\d{2,12}$/.test(s)
// A street and its number; a one-digit number is a sales route ("PALERMO 6"), not a height.
export const isAddress = (s: string) => /[a-zñ].*\s\d{2,5}\b/i.test(s)
/** A seller as Panda writes it: a first name and an initial ("MIRKO RA.", "Josefina Gi."). */
const isShortName = (s: string) => /^[a-zñ]{3,}( [a-zñ]{3,})? [a-zñ]{1,3}$/.test(normalize(s)) && /\.$/.test(s.trim())

// A title that is not about who the store is (a name, an area, a note) gives way to what the
// column plainly holds: a title can be wrong, or made up when a capture is transcribed.
const WEAK_TITLES = new Set<ImportField>(['name', 'area', 'task', 'ignore'])

/** What a column holds, from its title, else from what is in it. */
export function guessField(header: string, samples: string[]): ImportField {
  const h = normalize(header)
  const titled = h ? KEYWORDS.find(([, re]) => re.test(h))?.[0] : undefined
  const filled = samples.filter(Boolean)
  const share = (test: (s: string) => boolean) => filled.filter(test).length / filled.length
  const plain = !filled.length ? null
    : share(isAddress) >= 0.8 ? 'address'
    : share(isNumber) >= 0.9 ? 'customer_number'
    : share(isShortName) >= 0.8 ? 'seller'
    : null
  if (titled && plain && WEAK_TITLES.has(titled)) return plain
  if (titled) return titled
  if (!filled.length) return 'ignore'
  if (share(isAddress) >= 0.6) return 'address'
  if (share(isNumber) >= 0.8) return 'customer_number'
  if (share(isShortName) >= 0.8) return 'seller'
  // Words that repeat down the column, and are not days: a neighbourhood, or a sales route
  // named after it ("PALERMO 6").
  const words = filled.map(normalize)
  if (filled.length >= 3 && words.every((w) => /^[a-zñ ]+( \d{1,2})?$/.test(w) && !WEEKDAYS.test(w)) && new Set(words).size <= filled.length / 2) return 'area'
  return 'ignore'
}

/** Titles in the first row: a title names a known field, or the row has no numbers where the next one does. */
export function looksLikeHeader(table: Table): boolean {
  const [first, second] = table
  if (!first) return false
  if (first.some((c) => KEYWORDS.some(([field, re]) => field !== 'ignore' && re.test(normalize(c))))) return true
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
