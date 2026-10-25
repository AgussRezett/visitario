// Editing many stores at once: what they share now, and what a change would really do.

/** What a set of stores has in one field: the same value for all, or several ("Varios"). */
export type Shared<T> = { mixed: false; value: T } | { mixed: true; distinct: number }

export function shared<T>(values: readonly T[]): Shared<T> {
  const distinct = new Set(values)
  if (distinct.size === 1) return { mixed: false, value: values[0] as T }
  return { mixed: true, distinct: distinct.size }
}

/** The fields a bulk edit can change. A field left out stays as each store has it. */
export interface BulkChange {
  sellerId?: number | null
  channelId?: number | null
  area?: string | null
}

export interface BulkRow {
  sellerId: number | null
  channelId: number | null
  area: string | null
}

const FIELDS = ['sellerId', 'channelId', 'area'] as const

/** Zones are compared as people read them: "palermo " and "Palermo" are the same zone. */
const sameArea = (a: string | null, b: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

const differs = (row: BulkRow, change: BulkChange, field: (typeof FIELDS)[number]) => {
  if (!(field in change)) return false
  const wanted = change[field]
  return field === 'area' ? !sameArea(row.area, wanted as string | null) : row[field] !== wanted
}

/** How many stores the change really touches (some may already have the new value). */
export function affected(rows: readonly BulkRow[], change: BulkChange): number {
  return rows.filter((r) => FIELDS.some((f) => differs(r, change, f))).length
}

/** The change without the fields it would leave as they are for every store. */
export function effective(rows: readonly BulkRow[], change: BulkChange): BulkChange {
  const out: BulkChange = {}
  for (const f of FIELDS) {
    if (f in change && rows.some((r) => differs(r, change, f))) Object.assign(out, { [f]: change[f] })
  }
  return out
}

export const isEmptyChange = (c: BulkChange) => Object.keys(c).length === 0

/** Requests stay short: the ids go in the URL. */
export function chunks<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}
