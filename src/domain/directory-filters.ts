// The directory's filters, kept while going into a store and back.

export type DirectoryFilterKind = 'all' | 'unverified' | 'added' | 'archived'

export interface DirectoryFilters {
  query: string
  filter: DirectoryFilterKind
  area: string | null
  /** An id, 0 for "without", null for all. */
  channel: number | null
  seller: number | null
  page: number
}

export const NO_DIRECTORY_FILTERS: DirectoryFilters = { query: '', filter: 'all', area: null, channel: null, seller: null, page: 0 }

const KINDS: readonly DirectoryFilterKind[] = ['all', 'unverified', 'added', 'archived']
const id = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null)

/** Saved filters back, ignoring anything that does not fit (an old or edited value). */
export function readDirectoryFilters(raw: string | null): DirectoryFilters {
  if (!raw) return NO_DIRECTORY_FILTERS
  let v: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return NO_DIRECTORY_FILTERS
    v = parsed as Record<string, unknown>
  } catch {
    return NO_DIRECTORY_FILTERS
  }
  return {
    query: typeof v.query === 'string' ? v.query.slice(0, 100) : '',
    filter: KINDS.find((k) => k === v.filter) ?? 'all',
    area: typeof v.area === 'string' && v.area ? v.area : null,
    channel: id(v.channel),
    seller: id(v.seller),
    page: id(v.page) ?? 0,
  }
}
