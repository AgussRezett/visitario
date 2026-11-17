import type { Route } from '@playwright/test'
import type { FakeState, Row } from './fake-state'

const QUOTA = { month_used: 0, month_limit: 1000, my_today: 0, my_daily_limit: 30 }

/** Armar recorrido and the AI's limits: zones, candidates, routes into a day, written requests, PDFs read. */
export async function handlePlanner({ path, url, method, route, state, json, body }: {
  path: string; url: URL; method: string; route: Route; state: FakeState; json: (b: unknown, s?: number) => Promise<void>; body: () => Row
}): Promise<true | undefined> {
  const done = async (p: Promise<void>) => {
    await p
    return true as const
  }
  if (path.endsWith('/rpc/route_candidates')) return done(json(state.routeCandidates ?? []))
  if (path.endsWith('/rpc/add_stores_to_day')) {
    const b = body()
    ;(state.addedToDay ??= []).push({ workday: String(b.p_workday), stores: b.p_stores as string[] })
    return done(json((b.p_stores as string[]).length))
  }
  if (path.endsWith('/route_zone')) {
    const zones = (state.routeZones ??= [])
    if (method === 'POST') {
      const z = { id: `z${zones.length + 1}`, deleted_at: null, ...body() }
      zones.push(z)
      return done(json(z, 201))
    }
    if (method === 'PATCH') {
      const id = url.searchParams.get('id')?.replace('eq.', '')
      zones.filter((z) => z.id === id).forEach((z) => Object.assign(z, body()))
      return done(route.fulfill({ status: 204 }))
    }
    return done(json(zones.filter((z) => !z.deleted_at)))
  }
  if (path.endsWith('/functions/v1/plan-request')) {
    const r = state.planRequest
    if (!r || r.status) return done(json({ error: r?.error ?? 'not_configured' }, r?.status ?? 503))
    ;(r.asked ??= []).push(String(body().text))
    const q = (state.aiQuota ??= { ...QUOTA })
    Object.assign(q, { month_used: q.month_used + 1, my_today: q.my_today + 1 })
    return done(json({ plan: r.plan }))
  }
  if (path.endsWith('/functions/v1/read-brief')) {
    const r = state.brief
    if (!r || r.status) return done(json({ error: r?.error ?? 'not_configured' }, r?.status ?? 503))
    // A PDF alone gives its pages, no AI; the pages with the indications give the reading.
    if ((route.request().headers()['content-type'] ?? '').startsWith('multipart/')) return done(json({ pages: r.pages }))
    r.sent = body()
    const q = (state.aiQuota ??= { ...QUOTA })
    Object.assign(q, { month_used: q.month_used + 1, my_today: q.my_today + 1 })
    return done(json({ brief: r.brief }))
  }
  if (path.endsWith('/rpc/ai_quota')) return done(json([state.aiQuota ?? QUOTA]))
  if (path.endsWith('/rpc/company_ai_usage')) return done(json(state.aiUsage ?? { people: [], days: [] }))
  return undefined
}
