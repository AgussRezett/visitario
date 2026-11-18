import type { Route } from '@playwright/test'
import type { FakeState, Row } from './fake-supabase'

interface Ctx {
  path: string
  route: Route
  state: FakeState
  json: (body: unknown, status?: number) => Promise<void>
  body: () => Row
}

/** Closing a company and reopening it: memberships disabled and put back, as the database does. */
export async function handleClosure({ path, route, state, json, body }: Ctx): Promise<true | undefined> {
  const done = async (p: Promise<void>) => {
    await p
    return true as const
  }
  void route
  const name = String(state.company?.name ?? 'Panda')
  if (path.endsWith('/rpc/company_close_preview')) {
    return done(json([{ name, kind: 'distributor', members: 5, invited: 1, stores: 230, days_today: state.closure?.daysToday ?? 0 }]))
  }
  if (path.endsWith('/rpc/close_company')) {
    const b = body()
    if (String(b.p_name).trim().toLowerCase() !== name.toLowerCase()) return done(json({ message: 'The name does not match', code: '22023' }, 400))
    const company = String(b.p_company)
    const kept = (state.memberships ?? []).filter((m) => m.company_id === company).map((m) => ({ ...m }))
    state.memberships = (state.memberships ?? []).map((m) => (m.company_id === company ? { ...m, status: 'disabled' } : m))
    state.closure = { ...state.closure, closed: [{ company_id: company, name, closed_at: new Date().toISOString(), closed_by: 'Agustín Rezett', reopen_until: new Date(Date.now() + 30 * 86_400_000).toISOString(), kept, reason: b.p_reason }] }
    return done(json(state.closure.closed?.[0]?.reopen_until))
  }
  if (path.endsWith('/rpc/my_closed_companies')) return done(json((state.closure?.closed ?? []).map((c) => ({ company_id: c.company_id, name: c.name, closed_at: c.closed_at, closed_by: c.closed_by, reopen_until: c.reopen_until }))))
  if (path.endsWith('/rpc/reopen_company')) {
    const company = String(body().p_company)
    const closed = state.closure?.closed?.find((c) => c.company_id === company)
    if (!closed) return done(json({ message: 'Not a closed company you can reopen', code: '42501' }, 403))
    state.memberships = (state.memberships ?? []).map((m) => (m.company_id === company ? (closed.kept as Row[]).find((k) => k.id === m.id) ?? m : m))
    state.closure = { ...state.closure, closed: [] }
    return done(json(null))
  }
  return undefined
}
