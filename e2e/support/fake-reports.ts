import type { FakeState, Row } from './fake-state'

/** report_facts: the visits of the range with their store, work totals (from dailyMetrics) and people. */
export function reportFacts(state: FakeState, b: Row) {
  const from = String(b.p_from)
  const to = String(b.p_to)
  const visits = state.visits.filter((v) => !v.deleted_at && String(v.work_date) >= from && String(v.work_date) <= to)
  const storeOf = (v: Row) => (v.store as Row | null) ?? {}
  const facts = visits.map((v) => ({
    id: v.id, d: v.work_date, m: v.merchandiser_id, s: v.store_id ?? storeOf(v).id ?? `s-${String(v.id)}`, src: v.source ?? 'assigned',
    ws: v.work_status, rs: v.review_status, c: v.consent ?? null, r: v.rapport ?? null, a: v.arrived_at ?? null, f: v.finished_at ?? null, res: false,
    area: storeOf(v).area ?? null, ch: storeOf(v).channel_id ?? null, se: storeOf(v).seller_id ?? null,
    dt: ((v.display as Row[] | undefined) ?? []).length, da: 0, ph: ((v.photo as Row[] | undefined) ?? []).length,
  }))
  // Each person's work of a day goes on their first visit done that day.
  const metrics = (state.dailyMetrics ?? []).flatMap((m) => {
    const visit = facts.find((f) => f.m === m.merchandiser_id && f.d === m.work_date && f.ws === 'done')
    return visit ? [{ v: visit.id, id: m.metric_id, q: m.quantity }] : []
  })
  const people = (state.people ?? []).filter((p) => facts.some((f) => f.m === p.id)).map((p) => ({ id: p.id, first: p.first_name, last: p.last_name }))
  const lastOf = (s: unknown) => facts.filter((f) => f.s === s && ['done', 'refused', 'closed'].includes(String(f.ws))).map((f) => String(f.d)).sort().pop() ?? null
  const stores = [...new Map(facts.map((f) => [f.s, { s: f.s, name: storeOf(visits.find((v) => v.id === f.id) ?? {}).address ?? 'Local', area: f.area, ch: f.ch, se: f.se, last: lastOf(f.s) }])).values()]
  return { visits: facts, metrics, brands: [], stores, people }
}
