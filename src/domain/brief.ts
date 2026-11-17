/**
 * Visits sent as a PDF (a slide per store: "Cabildo 1130 #553" and photos of how it was left)
 * with written indications ("todos son de Pablo Fo, menos Olaguer y Feliu que es de Mirko Ra;
 * decime si falta algo y ordená como en el PDF"). The AI reads both; here only what is really
 * in the PDF gets through, in the PDF's own order, and sellers and people only from the lists.
 */
import { formatLongDate } from './dates'
import { normalize } from './import-columns'
import { comingDate, findPerson } from './plan-request'

export interface BriefStop {
  /** As written in the PDF. */
  address: string
  /** The PDF's own reference for the store ("#553"); not taken as the customer number. */
  ref: string
  /** Pages where the store is, from 1. */
  pages: number[]
  sellerId: number | null
}

export interface BriefCatalog {
  sellers: readonly { id: number; name: string }[]
  people: readonly { personId: string; firstName: string; lastName: string }[]
}

export interface UnderstoodBrief {
  stops: BriefStop[]
  /** What to do in every store, from the indications. */
  task: string
  date: string | null
  personId: string | null
  /** What the indications name that the lists do not have. */
  unknown: string[]
  /** Addresses the AI gave that are not in the PDF as written: left out. */
  dropped: number
  chips: string[]
}

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const text = (v: unknown, max = 80) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')
const flat = (t: string) => normalize(t).replace(/\s+/g, ' ')

/** The AI's reading, kept only where the PDF and the lists say so. */
export function understandBrief(raw: unknown, pages: readonly string[], cat: BriefCatalog, today: string): UnderstoodBrief {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const texts = pages.map(flat)
  const found: (BriefStop & { at: number })[] = []
  let dropped = 0

  for (const item of list(r.stops)) {
    const s = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const address = text(s.address)
    const page = typeof s.page === 'number' ? Math.trunc(s.page) : Number(s.page)
    const where = texts[page - 1]
    const at = where && address.length >= 3 ? where.indexOf(flat(address)) : -1
    if (at < 0) {
      dropped++
      continue
    }
    const digits = text(s.ref).replace(/\D/g, '')
    const ref = digits && where?.includes(digits) ? `#${digits}` : ''
    const seller = cat.sellers.find((x) => x.id === Number(s.seller_id))
    const same = found.find((f) => flat(f.address) === flat(address))
    if (same) {
      if (!same.pages.includes(page)) same.pages.push(page)
      same.ref ||= ref
      same.sellerId ??= seller?.id ?? null
    } else found.push({ address, ref, pages: [page], sellerId: seller?.id ?? null, at: page * 1e6 + at })
  }
  // The PDF's order, whatever order the AI answered in.
  const stops = found.sort((a, b) => a.at - b.at).map((s) => ({ address: s.address, ref: s.ref, pages: s.pages.sort((a, b) => a - b), sellerId: s.sellerId }))

  const unknown = list(r.unknown).map((u) => text(u, 60)).filter(Boolean).slice(0, 5)
  const said = text(r.merchandiser, 60)
  const person = findPerson(said, cat.people)
  if (said && !person && cat.people.length) unknown.push(`el activador "${said}"`)
  const date = comingDate(r.date, today)
  const task = text(r.task, 160)

  const chips = [`${stops.length} ${stops.length === 1 ? 'local' : 'locales'}, en el orden del PDF`]
  for (const s of cat.sellers) {
    const n = stops.filter((x) => x.sellerId === s.id).length
    if (n) chips.push(`${s.name}: ${n}`)
  }
  if (person) chips.push(`Para: ${person.firstName} ${person.lastName}`)
  if (date) chips.push(`Día: ${formatLongDate(date).toLowerCase()}`)

  return { stops, task, date, personId: person?.personId ?? null, unknown, dropped, chips }
}

/** "pág. 2" or "págs. 2 y 3". */
export function pagesText(pages: readonly number[]) {
  if (pages.length < 2) return `pág. ${pages[0] ?? ''}`.trim()
  return `págs. ${pages.slice(0, -1).join(', ')} y ${pages[pages.length - 1]}`
}

/** The visit's task: what to do, and where to look in the PDF ("Avisar si falta algo · PDF págs. 2 y 3 · #553"). */
export const stopTask = (task: string, s: BriefStop) => [task, `PDF ${pagesText(s.pages)}`, s.ref].filter(Boolean).join(' · ')

/** For the merchandiser's list: "Cabildo 1130 @Pablo Fo", with its task. */
export function briefLines(b: UnderstoodBrief, sellers: readonly { id: number; name: string }[]): { text: string; task: string }[] {
  return b.stops.map((s) => {
    const seller = sellers.find((x) => x.id === s.sellerId)
    return { text: seller ? `${s.address} @${seller.name}` : s.address, task: stopTask(b.task, s) }
  })
}
