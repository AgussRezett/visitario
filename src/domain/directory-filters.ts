// The directory's filters, kept while going into a store and back.

export type DirectoryFilterKind = 'all' | 'unverified' | 'added' | 'archived'

/** How the directory is ordered (the database's store_directory_v2 p_sort). */
export type DirectorySort = 'name' | 'address' | 'customer' | 'area' | 'recent_visit' | 'oldest_visit' | 'most_visits' | 'newest'

export const DIRECTORY_SORTS: readonly { value: DirectorySort; label: string }[] = [
  { value: 'name', label: 'Nombre (A–Z)' },
  { value: 'address', label: 'Dirección (A–Z)' },
  { value: 'customer', label: 'Nro. de cliente' },
  { value: 'area', label: 'Zona (A–Z)' },
  { value: 'recent_visit', label: 'Visitados hace poco' },
  { value: 'oldest_visit', label: 'Más tiempo sin visitar' },
  { value: 'most_visits', label: 'Más visitas en 30 días' },
  { value: 'newest', label: 'Agregados recientemente' },
]

/**
 * A table column's header sorts by it; tapping again flips the order where it has two
 * (last visit: recent ↔ longest ago). Columns that are not sortable are absent.
 */
export function headerSort(column: 'name' | 'customer' | 'area' | 'last_visit' | 'visits', current: DirectorySort): DirectorySort {
  if (column === 'last_visit') return current === 'recent_visit' ? 'oldest_visit' : 'recent_visit'
  return ({ name: 'name', customer: 'customer', area: 'area', visits: 'most_visits' } as const)[column]
}

export interface DirectoryFilters {
  query: string
  filter: DirectoryFilterKind
  /** Several at once; none means all (and 0, for channels and sellers, means "without"). */
  areas: string[]
  channels: number[]
  sellers: number[]
  sort: DirectorySort
  page: number
}

export const NO_DIRECTORY_FILTERS: DirectoryFilters = { query: '', filter: 'all', areas: [], channels: [], sellers: [], sort: 'name', page: 0 }

const KINDS: readonly DirectoryFilterKind[] = ['all', 'unverified', 'added', 'archived']
const id = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null)
/** A list of ids, or one id saved by an older version (the filters held one value). */
const ids = (list: unknown, one: unknown) => (Array.isArray(list) ? list.map(id).filter((n): n is number => n !== null) : id(one) === null ? [] : [id(one) as number])

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
    areas: Array.isArray(v.areas) ? v.areas.filter((a): a is string => typeof a === 'string' && a !== '') : typeof v.area === 'string' && v.area ? [v.area] : [],
    channels: ids(v.channels, v.channel),
    sellers: ids(v.sellers, v.seller),
    sort: DIRECTORY_SORTS.find((s) => s.value === v.sort)?.value ?? 'name',
    page: id(v.page) ?? 0,
  }
}
