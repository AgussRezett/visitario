import type { Row } from './fake-state'

const text = (v: unknown) => String(v ?? '')
const byName = (a: Row, b: Row) => (a.name == null ? 1 : 0) - (b.name == null ? 1 : 0) || text(a.name).localeCompare(text(b.name)) || text(a.address).localeCompare(text(b.address))

/** store_directory_v2's p_sort, as far as the tests need it. */
export function directorySort(sort: string) {
  return (a: Row, b: Row): number => {
    const da = text(a.last_visit_date), db = text(b.last_visit_date)
    const na = text(a.customer_number), nb = text(b.customer_number)
    switch (sort) {
      case 'customer': return (na ? 0 : 1) - (nb ? 0 : 1) || na.length - nb.length || na.localeCompare(nb) || byName(a, b)
      case 'recent_visit': return (da ? 0 : 1) - (db ? 0 : 1) || db.localeCompare(da) || byName(a, b)
      case 'oldest_visit': return (da ? 1 : 0) - (db ? 1 : 0) || da.localeCompare(db) || byName(a, b)
      case 'most_visits': return Number(b.visits_30d ?? 0) - Number(a.visits_30d ?? 0) || byName(a, b)
      case 'address': return text(a.address).localeCompare(text(b.address)) || byName(a, b)
      default: return byName(a, b)
    }
  }
}
