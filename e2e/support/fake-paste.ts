import type { FakeState, Row } from './fake-state'

const norm = (t: unknown) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/**
 * add_visits: each pasted row on its own, as the database does. Stores in `state.stores`
 * with `deleted_at` are archived; `addVisit` adds the stop and returns its id.
 */
export function addVisits(state: FakeState, b: Row, addVisit: (b: Row) => string) {
  const stores = (state.stores ??= [])
  const workdayId = String(b.p_workday)
  return ((b.p_rows as Row[] | undefined) ?? []).map((r, idx) => {
    const base = { idx, visit_id: null, store_id: null, matched_by: null, created: false, error: null, detail: null }
    const num = String(r.customer_number ?? '').trim()
    const address = String(r.address ?? '').trim()
    const byNumber = num ? stores.find((s) => s.customer_number === num) : undefined
    if (byNumber?.deleted_at) return { ...base, error: 'archived_customer', detail: byNumber.address }
    const found = byNumber ?? (address.length >= 3 ? stores.find((s) => !s.deleted_at && norm(s.address) === norm(address)) : undefined)
    if (!found && address.length < 3) return { ...base, error: 'no_address' }
    const already = found ? state.visits.find((v) => v.store_id === found.id && (v.workday_id ?? 'w1') === workdayId) : undefined
    if (already) return { ...base, visit_id: already.id, store_id: found?.id, matched_by: byNumber ? 'customer' : 'address' }
    const visitId = addVisit({ p_workday: b.p_workday, p_store: found?.id, p_address: address })
    const storeId = String(state.visits.find((v) => v.id === visitId)?.store_id)
    if (!found) stores.push({ id: storeId, address, customer_number: num || null, area: r.area ?? null })
    if (r.channel || r.seller) (state.tagged ??= []).push({ p_store: storeId, p_channel: r.channel ?? null, p_seller: r.seller ?? null })
    return { ...base, visit_id: visitId, store_id: storeId, matched_by: found ? (byNumber ? 'customer' : 'address') : null, created: true }
  })
}
