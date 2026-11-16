import type { Route } from '@playwright/test'
import type { FakeState, Row } from './fake-state'

/** The seller's visits and coverage: reads and the functions behind them. */
export async function handleSellerVisits({ path, url, method, route, state, json, body }: {
  path: string; url: URL; method: string; route: Route; state: FakeState; json: (b: unknown, s?: number) => Promise<void>; body: () => Row
}): Promise<true | undefined> {
  const done = async (p: Promise<void>) => {
    await p
    return true as const
  }
  const all = () => (state.sellerVisits ??= [])
  if (path.endsWith('/seller_visit') && method === 'GET') {
    const store = url.searchParams.get('store_id')?.replace('eq.', '')
    return done(json(all().filter((v) => v.store_id === store && !v.deleted_at).sort((a, b) => String(b.visited_at).localeCompare(String(a.visited_at)))))
  }
  if (path.endsWith('/rpc/record_seller_visit')) {
    const b = body()
    if (!all().some((v) => v.id === b.p_id)) {
      all().push({ id: b.p_id, store_id: b.p_store, outcome: b.p_outcome, reason: b.p_reason ?? null, note: b.p_note ?? null,
        order_lines: b.p_lines ?? [], visited_at: new Date().toISOString(), deleted_at: null })
    }
    return done(json(b.p_id))
  }
  if (path.endsWith('/rpc/remove_seller_visit')) {
    const v = all().find((x) => x.id === body().p_id)
    if (v) v.deleted_at = new Date().toISOString()
    return done(route.fulfill({ status: 204 }))
  }
  if (path.endsWith('/rpc/set_seller_target')) {
    const b = body()
    ;(state.targets ??= []).push(b)
    const c = (state.coverage ?? []).find((x) => x.seller_id === b.p_seller)
    if (c) c.monthly_target = b.p_target || null
    return done(route.fulfill({ status: 204 }))
  }
  if (path.endsWith('/rpc/seller_coverage')) return done(json(state.coverage ?? []))
  return undefined
}
