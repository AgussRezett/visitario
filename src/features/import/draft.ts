import { useMemo, useState } from 'react'
import {
  classify, guessMapping, linesToRows, looksLikeHeader, matchPerson, normalize, signatureOf, toRows,
  type ImportField, type ImportMapping, type ImportRow, type Person, type PersonMatch, type RowStatus, type StoreMatch, type Table,
} from '@/domain/import'
import type { Sheet } from './api/read-file'
import type { SavedFormat } from './api/import'

/** Everything the supervisor decided so far. Nothing reaches the server until "Agregar". */
export interface Draft {
  fileName: string | null
  sheets: Sheet[]
  sheet: number
  /** Pasted addresses, one per line (no columns to map). */
  lines: string[] | null
  mapping: ImportMapping
  /** The saved format in use, if the columns were recognised. */
  format: SavedFormat | null
  saveFormat: boolean
  formatName: string
  /** Who gets the rows without a name: the merchandiser chosen in "Para". */
  fallback: string | null
  /** Addresses typed in the review, by row line. */
  edits: Record<number, string>
  skipped: number[]
}

const emptyMapping = (): ImportMapping => ({ hasHeader: true, columns: [], scope: 'caba', aliases: {} })

export const emptyDraft = (fallback: string | null): Draft => ({
  fileName: null, sheets: [], sheet: 0, lines: null, mapping: emptyMapping(), format: null,
  saveFormat: true, formatName: '', fallback, edits: {}, skipped: [],
})

export const tableOf = (d: Draft): Table => d.sheets[d.sheet]?.table ?? []
export const signatureFor = (d: Draft) => (d.mapping.hasHeader ? signatureOf(tableOf(d)[0] ?? []) : null)

/** A sheet just read: the saved format for its titles, or a fresh guess. */
export function withSheets(d: Draft, fileName: string | null, sheets: Sheet[], sheet: number, formats: SavedFormat[]): Draft {
  const table = sheets[sheet]?.table ?? []
  const hasHeader = looksLikeHeader(table)
  const format = hasHeader ? formats.find((f) => f.signature === signatureOf(table[0] ?? [])) ?? null : null
  const mapping: ImportMapping = format
    ? { ...format.mapping, aliases: format.mapping.aliases ?? {} }
    : { ...emptyMapping(), hasHeader, columns: guessMapping(table, hasHeader) }
  return { ...d, fileName, sheets, sheet, lines: null, mapping, format, formatName: format?.name ?? d.formatName, edits: {}, skipped: [] }
}

export function useDraft(fallback: string | null) {
  const [draft, setDraft] = useState(() => emptyDraft(fallback))
  const update = (change: Partial<Draft> | ((d: Draft) => Partial<Draft>)) => setDraft((d) => ({ ...d, ...(typeof change === 'function' ? change(d) : change) }))
  const setColumn = (i: number, field: ImportField) =>
    update((d) => ({
      mapping: { ...d.mapping, columns: d.mapping.columns.map((f, j) => (j === i ? field : f === field && field !== 'ignore' ? 'ignore' : f)) },
    }))
  const setAlias = (name: string, personId: string) =>
    update((d) => ({ mapping: { ...d.mapping, aliases: { ...d.mapping.aliases, [normalize(name)]: personId } } }))
  return { draft, setDraft, update, setColumn, setAlias }
}

/** The rows as they will be imported, with the addresses typed in the review. */
export function draftRows(d: Draft): ImportRow[] {
  const rows = d.lines ? linesToRows(d.lines) : toRows(tableOf(d), d.mapping.columns, d.mapping.hasHeader)
  return rows.map((r) => (d.edits[r.line] !== undefined ? { ...r, address: d.edits[r.line] ?? r.address } : r))
}

export interface NameCheck {
  name: string
  rows: number
  match: PersonMatch
}

/** The names in the merchandiser column, how sure we are about each, and how many rows have it. */
export function useNames(rows: ImportRow[], people: Person[], aliases: Record<string, string>): NameCheck[] {
  return useMemo(() => {
    const byName = new Map<string, NameCheck>()
    for (const r of rows) {
      if (!r.merchandiser) continue
      const key = normalize(r.merchandiser)
      const found = byName.get(key)
      if (found) found.rows++
      else byName.set(key, { name: r.merchandiser, rows: 1, match: matchPerson(r.merchandiser, people, aliases) })
    }
    return [...byName.values()]
  }, [rows, people, aliases])
}

export interface ReviewRow extends ImportRow {
  person: Person | null
  match: StoreMatch | undefined
  status: RowStatus
  reason?: string
}

/** Each row with its person (only sure matches count), its directory match and its state. */
export function reviewRows(rows: ImportRow[], matches: Map<number, StoreMatch> | undefined, people: Person[], d: Draft): ReviewRow[] {
  const fallback = people.find((p) => p.id === d.fallback) ?? null
  return rows.map((r, i) => {
    const m = r.merchandiser ? matchPerson(r.merchandiser, people, d.mapping.aliases) : null
    const person = m ? (m.kind === 'sure' ? m.person : null) : fallback
    const match = matches?.get(i)
    const state = classify(r, match, person)
    const reason = m?.kind === 'guess' ? `Confirmá si "${r.merchandiser}" es ${m.person.firstName} ${m.person.lastName}` : state.reason
    return { ...r, person, match, status: state.status, reason }
  })
}
