import type { FakeState, Row } from './fake-state'

const norm = (t: unknown) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/** day_overlaps: the stops of other days in `state.overlaps` that match each row asked, with its idx. */
export function dayOverlaps(state: FakeState, rows: Row[]) {
  return rows.flatMap((r, idx) =>
    (state.overlaps ?? [])
      .filter((o) => (r.store_id && o.store_id === r.store_id) || (r.customer_number && o.customer_number === r.customer_number) || (norm(r.address).length >= 3 && norm(o.address) === norm(r.address)))
      .map((o) => ({ idx, visit_id: `o-${idx}`, same_workday: false, added_by_merchandiser: false, work_status: 'pending', ...o })),
  )
}
