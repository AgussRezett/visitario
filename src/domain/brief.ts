/**
 * Visits read by AI from what arrives (captures, photos, PDFs with a slide per store) with
 * optional written indications ("todos son de Pablo Fo, menos Olaguer y Feliu que es de Mirko
 * Ra; decime si falta algo y ordená como en el PDF"). The AI reads them all; here only what is
 * really written in them gets through, in their own order, and sellers and people only from
 * the lists.
 */
import { formatLongDate } from './dates'
import { normalize } from './import-columns'
import { comingDate, findPerson } from './plan-request'
import type { Transcript } from './capture'

/** One file read: a PDF's pages, or a capture's transcript as one page. */
export interface Source {
  kind: 'pdf' | 'image'
  pages: string[]
}

/** A page of text the AI read, numbered from 1 across all files, and how to name it to a person. */
export interface BriefPage {
  text: string
  /** "PDF pág. 2", "captura 3". */
  label: string
}

export interface BriefStop {
  /** As written. */
  address: string
  /** The client number, when the source has it as such. */
  customerNumber: string
  area: string
  /** A deck's own reference for the store ("#553"); not taken as the customer number. */
  ref: string
  /** Pages where the store is (see BriefPage), from 1. */
  pages: number[]
  /** Where to look in a PDF: "PDF págs. 2 y 3"; "" when it came from a capture. */
  where: string
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
  /** Addresses the AI gave that are not written that way: left out. */
  dropped: number
  chips: string[]
}

/** A capture's transcript as plain text: title, column titles, then a row a line. */
export const transcriptText = (t: Transcript) => [t.title, t.headers.join(' | '), ...t.rows.map((r) => r.join(' | '))].filter(Boolean).join('\n')

/** All the files as numbered pages, each with how to name it ("PDF 2 pág. 3" when there are several PDFs). */
export function briefPages(sources: readonly Source[]): BriefPage[] {
  const pdfs = sources.filter((s) => s.kind === 'pdf').length
  const images = sources.filter((s) => s.kind === 'image').length
  let pdf = 0
  let image = 0
  return sources.flatMap((s) => {
    if (s.kind === 'image') {
      image++
      return s.pages.map((text) => ({ text, label: images > 1 ? `captura ${image}` : 'la captura' }))
    }
    pdf++
    return s.pages.map((text, i) => ({ text, label: `${pdfs > 1 ? `PDF ${pdf}` : 'PDF'} pág. ${i + 1}` }))
  })
}

/** "PDF págs. 2 y 3", "captura 1", "PDF pág. 4 y captura 2". */
export function whereText(labels: readonly string[]): string {
  const groups = new Map<string, string[]>()
  for (const l of labels) {
    const [, head = l, page] = /^(.*) pág\. (\d+)$/.exec(l) ?? []
    const list = groups.get(head) ?? []
    if (page && !list.includes(page)) list.push(page)
    groups.set(head, list)
  }
  const and = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`)
  return and([...groups].map(([head, pages]) => (pages.length ? `${head} ${pages.length > 1 ? 'págs.' : 'pág.'} ${and(pages)}` : head)))
}

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const text = (v: unknown, max = 80) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/\s+/g, ' ').trim().slice(0, max) : '')
const flat = (t: string) => normalize(t).replace(/\s+/g, ' ')

/** The AI's reading, kept only where the files and the lists say so. */
export function understandBrief(raw: unknown, pages: readonly BriefPage[], cat: BriefCatalog, today: string): UnderstoodBrief {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const texts = pages.map((p) => flat(p.text))
  const found: (Omit<BriefStop, 'where'> & { at: number })[] = []
  let dropped = 0

  for (const item of list(r.stops)) {
    const s = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const address = text(s.address)
    const page = Math.trunc(Number(s.page))
    const where = texts[page - 1]
    const at = where && address.length >= 3 ? where.indexOf(flat(address)) : -1
    if (!where || at < 0) {
      dropped++
      continue
    }
    // Only what is written on that page.
    const digits = text(s.ref).replace(/\D/g, '')
    const ref = digits && where.includes(digits) ? `#${digits}` : ''
    const number = text(s.customer_number, 20)
    const customerNumber = number && where.includes(flat(number)) ? number : ''
    const areaSaid = text(s.area, 40)
    const area = areaSaid && where.includes(flat(areaSaid)) ? areaSaid : ''
    const seller = cat.sellers.find((x) => x.id === Number(s.seller_id))
    const same = found.find((f) => flat(f.address) === flat(address))
    if (same) {
      if (!same.pages.includes(page)) same.pages.push(page)
      same.ref ||= ref
      same.customerNumber ||= customerNumber
      same.area ||= area
      same.sellerId ??= seller?.id ?? null
    } else found.push({ address, customerNumber, area, ref, pages: [page], sellerId: seller?.id ?? null, at: page * 1e6 + at })
  }
  // The files' order, whatever order the AI answered in.
  const stops = found.sort((a, b) => a.at - b.at).map((s) => {
    const sorted = s.pages.sort((a, b) => a - b)
    return {
      address: s.address, customerNumber: s.customerNumber, area: s.area, ref: s.ref, pages: sorted,
      // Only a PDF's pages are worth going back to (their photos); a capture is just the list.
      where: whereText(sorted.map((p) => pages[p - 1]?.label ?? '').filter((l) => l.includes(' pág. '))), sellerId: s.sellerId,
    }
  })

  const unknown = list(r.unknown).map((u) => text(u, 60)).filter(Boolean).slice(0, 5)
  const said = text(r.merchandiser, 60)
  const person = findPerson(said, cat.people)
  if (said && !person && cat.people.length) unknown.push(`el activador "${said}"`)
  const date = comingDate(r.date, today)
  const task = text(r.task, 160)

  const chips = [`${stops.length} ${stops.length === 1 ? 'local' : 'locales'}, en el orden de los archivos`]
  for (const s of cat.sellers) {
    const n = stops.filter((x) => x.sellerId === s.id).length
    if (n) chips.push(`${s.name}: ${n}`)
  }
  if (person) chips.push(`Para: ${person.firstName} ${person.lastName}`)
  if (date) chips.push(`Día: ${formatLongDate(date).toLowerCase()}`)

  return { stops, task, date, personId: person?.personId ?? null, unknown, dropped, chips }
}

/** The visit's task: what to do, and where to look ("Avisar si falta algo · PDF págs. 2 y 3 · #553"). */
export const stopTask = (task: string, s: BriefStop) => [task, s.where, s.ref].filter(Boolean).join(' · ')

/** For the merchandiser's list: "564; Cabildo 1130; Belgrano @Pablo Fo", with its task. */
export function briefLines(b: UnderstoodBrief, sellers: readonly { id: number; name: string }[]): { text: string; task: string }[] {
  return b.stops.map((s) => {
    const seller = sellers.find((x) => x.id === s.sellerId)
    const parts = [s.customerNumber, s.address, s.area].filter(Boolean).join('; ')
    return { text: seller ? `${parts} @${seller.name}` : parts, task: stopTask(b.task, s) }
  })
}
