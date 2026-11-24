// Several stores to add to a day, checked before adding: one row each, with its customer
// number, address, neighbourhood, seller and channel, whatever they came from (lines pasted
// one by one, or a capture read by AI). Pure: no React, no Supabase.
import { transcriptToTable, type Transcript } from './capture'
import { toRows } from './import'
import { normalize } from './import-columns'
import { findByName, type Mentionable } from './mentions'

export interface ReviewRow {
  /** Stable while the list is edited: where the row came from. */
  key: string
  customerNumber: string
  address: string
  area: string
  sellerId: number | null
  /** The seller the list names when it is not one of the company's yet ("Juan Pérez"): to create or replace. */
  sellerName: string
  /** '' not chosen yet, 'none' for "Sin canal", or the channel's id. */
  channel: string
  task: string
  /** The directory's store this row is (same customer number, or the same address written another way). */
  known?: KnownStore
}

export interface KnownStore {
  id: string
  name: string | null
  address: string
  area: string | null
  customerNumber: string | null
  channelId: number | null
  sellerId: number | null
  /** How it was found. */
  by: 'customer' | 'address'
}

export interface PastedLineLike {
  text: string
  customerNumber: string
  address: string
  area: string
  sellerId: number | null
  channelId: number | null
  unknown: string[]
}

/** Lines pasted one by one ("564; Lacroze 3265; Belgrano @Mirko #Kiosco"), as rows. */
export function rowsFromLines(lines: readonly PastedLineLike[], taskFor: (address: string) => string = () => '', source = 'line'): ReviewRow[] {
  const seen = new Map<string, number>()
  return lines.map((l) => {
    const n = seen.get(l.text) ?? 0
    seen.set(l.text, n + 1)
    return {
      key: `${source}:${l.text}:${n}`,
      customerNumber: l.customerNumber,
      address: l.address,
      area: l.area,
      sellerId: l.sellerId,
      sellerName: l.sellerId === null ? (l.unknown.find((u) => u.startsWith('@'))?.slice(1) ?? '') : '',
      channel: l.channelId === null ? '' : String(l.channelId),
      task: taskFor(l.address),
    }
  })
}

const words = (t: string) => normalize(t).replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * The company's channel a text names as a whole word, also in plural ("KIOSCOS",
 * "Autoservicio Don Pepe"); null when none or more than one does.
 */
export function channelIn(text: string, channels: readonly Mentionable[]): Mentionable | null {
  const t = ` ${words(text)} `
  const found = channels.filter((c) => {
    const name = words(c.name)
    return name.length >= 3 && new RegExp(` ${name}(s|es)? `).test(t)
  })
  return found.length === 1 ? (found[0] ?? null) : null
}

const title = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase())

/**
 * A capture read by AI, as rows. The seller is one of the company's when the name matches
 * ("MIRKO RA." is Mirko Ra), otherwise it is kept by name to create it. The channel comes
 * from its column, or from the store's own text ("KIOSCO EL SOL"), or from the list's title
 * ("AUTOSERVICIOS ZONA NORTE") for every row.
 */
export function rowsFromTranscript(t: Transcript, sellers: readonly Mentionable[], channels: readonly Mentionable[], source = 'capture'): ReviewRow[] {
  const { table, columns, hasHeader } = transcriptToTable(t)
  const forAll = channelIn(t.title, channels)
  return toRows(table, columns, hasHeader).map((r, i) => {
    const seller = r.seller ? findByName(r.seller, sellers) : null
    const channel = (r.channel ? findByName(r.channel, channels) ?? channelIn(r.channel, channels) : null)
      ?? channelIn(`${r.name} ${r.address}`, channels)
      ?? forAll
    return {
      key: `${source}:${i}`,
      customerNumber: r.customerNumber,
      address: r.address,
      area: r.area,
      sellerId: seller?.id ?? null,
      sellerName: seller || !r.seller ? '' : title(r.seller),
      channel: channel ? String(channel.id) : '',
      task: r.task,
    }
  }).filter((r) => r.address || r.customerNumber)
}

/** Sellers the list names that the company does not have yet, with how many rows each. */
export function unknownSellers(rows: readonly ReviewRow[]): { name: string; count: number }[] {
  const byName = new Map<string, { name: string; count: number }>()
  for (const r of rows) {
    if (r.sellerId !== null || !r.sellerName) continue
    const k = normalize(r.sellerName)
    const entry = byName.get(k) ?? { name: r.sellerName, count: 0 }
    entry.count++
    byName.set(k, entry)
  }
  return [...byName.values()]
}

/** Gives a seller to every row that named them. */
export function assignSeller(rows: readonly ReviewRow[], name: string, sellerId: number): ReviewRow[] {
  const k = normalize(name)
  return rows.map((r) => (r.sellerId === null && normalize(r.sellerName) === k ? { ...r, sellerId, sellerName: '' } : r))
}

/** What a row still needs before adding it; null when ready. */
export function rowProblem(r: ReviewRow, hasChannels: boolean): string | null {
  // A directory store is already what it is: nothing to fill in.
  if (r.known) return null
  if (r.address.trim().length < 3 && !r.customerNumber.trim()) return 'Falta la dirección'
  if (hasChannels && r.channel === '') return 'Elegí el canal'
  return null
}

/**
 * Keeps what was edited when the list is built again (after going back to paste more):
 * a row with the same origin comes back as it was left; removed ones stay out.
 */
export function keepEdits(fresh: readonly ReviewRow[], before: readonly ReviewRow[], removed: ReadonlySet<string>): ReviewRow[] {
  const edited = new Map(before.map((r) => [r.key, r]))
  return fresh.filter((r) => !removed.has(r.key)).map((r) => edited.get(r.key) ?? r)
}

/**
 * Marks the rows that are directory stores, and fills what the row did not say with the
 * store's own (its channel and seller). A row whose address or number changed so that it no
 * longer matches is a new store again.
 */
export function applyKnown(rows: readonly ReviewRow[], known: ReadonlyMap<string, KnownStore>): ReviewRow[] {
  return rows.map((r) => {
    const k = known.get(r.key)
    if (!k) return r.known ? { ...r, known: undefined } : r
    if (r.known?.id === k.id) return r
    return {
      ...r,
      known: k,
      channel: r.channel || (k.channelId === null ? '' : String(k.channelId)),
      sellerId: r.sellerId ?? k.sellerId,
      sellerName: r.sellerId ?? k.sellerId ? '' : r.sellerName,
    }
  })
}
