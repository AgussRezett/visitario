import type { Route } from '@playwright/test'
import type { FakeState, Row } from './fake-state'

/** The PostgREST filters the requests use: eq.<value> and is.null. */
const keep = (row: Row, params: URLSearchParams) =>
  [...params].every(([key, raw]) => (raw.startsWith('eq.') ? String(row[key]) === raw.slice(3) : raw === 'is.null' ? row[key] == null : true))

/** Pedidos de activación: reads, and the seller's and supervisor's functions. */
export async function handleRequests({ path, url, method, route, state, json, body }: {
  path: string; url: URL; method: string; route: Route; state: FakeState; json: (b: unknown, s?: number) => Promise<void>; body: () => Row
}): Promise<true | undefined> {
  const done = async (p: Promise<void>) => {
    await p
    return true as const
  }
  const all = () => (state.requests ??= [])
  const find = (id: unknown) => all().find((r) => r.id === id)
  if (path.endsWith('/activation_request')) {
    const found = all().filter((r) => keep(r, url.searchParams))
    if (method === 'HEAD') return done(route.fulfill({ status: 200, headers: { 'content-range': `*/${found.length}`, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' } }))
    const desc = url.searchParams.get('order')?.includes('desc')
    return done(json([...found].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) * (desc ? -1 : 1))))
  }
  if (path.endsWith('/rpc/request_activation')) {
    const b = body()
    const id = `r${all().length + 1}`
    all().push({ id, store_id: b.p_store, company_id: 'c1', note: b.p_note ?? null, status: 'open', created_at: new Date().toISOString(), deleted_at: null,
      scheduled_for: null, answer: null, asker: { first_name: 'Florencia', last_name: 'Paz' }, assignee: null, store: state.requestStore ?? null })
    return done(json(id))
  }
  if (path.endsWith('/rpc/cancel_activation_request')) {
    const r = find(body().p_request)
    if (r) r.deleted_at = new Date().toISOString()
    return done(route.fulfill({ status: 204 }))
  }
  if (path.endsWith('/rpc/schedule_activation_request')) {
    const b = body()
    ;(state.scheduled ??= []).push(b)
    const r = find(b.p_request)
    if (r) Object.assign(r, { status: 'scheduled', scheduled_for: b.p_date, assignee: { first_name: 'Lucía' } })
    return done(json('v-new'))
  }
  if (path.endsWith('/rpc/dismiss_activation_request')) {
    const b = body()
    const r = find(b.p_request)
    if (r) Object.assign(r, { status: 'dismissed', answer: b.p_answer ?? null })
    return done(route.fulfill({ status: 204 }))
  }
  return undefined
}
