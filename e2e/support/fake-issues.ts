import type { Request, Route } from '@playwright/test'
import type { FakeState, Row } from './fake-state'

const ME = 'p1'

/** The PostgREST filters the novedades use: eq.<value> and is.null. */
const keep = (row: Row, params: URLSearchParams) =>
  [...params].every(([key, raw]) => (raw.startsWith('eq.') ? String(row[key]) === raw.slice(3) : raw === 'is.null' ? row[key] == null : true))

/** Novedades: store_issue reads and writes, resolving and taking them back. */
export async function handleIssues({ path, url, req, route, state, json, body }: {
  path: string; url: URL; req: Request; route: Route; state: FakeState; json: (b: unknown, s?: number) => Promise<void>; body: () => Row
}): Promise<true | undefined> {
  const done = async (p: Promise<void>) => {
    await p
    return true as const
  }
  if (path.endsWith('/store_issue') && req.method() === 'POST') {
    const b = body()
    const issues = (state.issues ??= [])
    if (!issues.some((i) => i.id === b.id)) {
      const visit = state.visits.find((v) => v.id === b.visit_id)
      issues.push({ ...b, status: 'open', created_by: ME, created_at: new Date().toISOString(), deleted_at: null, resolved_at: null, resolved_by: null, resolution: null,
        creator: { first_name: 'Agustín', last_name: 'Rezett' }, resolver: null, store: visit?.store ?? null })
    }
    return done(route.fulfill({ status: 201 }))
  }
  if (path.endsWith('/store_issue')) {
    const found = (state.issues ?? []).filter((i) => keep(i, url.searchParams))
    if (req.method() === 'HEAD') return done(route.fulfill({ status: 200, headers: { 'content-range': `*/${found.length}`, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' } }))
    return done(json([...found].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))))
  }
  if (path.endsWith('/rpc/resolve_store_issue')) {
    const b = body()
    ;(state.resolved ??= []).push(b)
    const i = (state.issues ?? []).find((x) => x.id === b.p_issue)
    if (i) Object.assign(i, b.p_resolved === false
      ? { status: 'open', resolved_at: null, resolver: null, resolution: null }
      : { status: 'resolved', resolved_at: new Date().toISOString(), resolver: { first_name: 'Martín' }, resolution: b.p_note ?? null })
    return done(route.fulfill({ status: 204 }))
  }
  if (path.endsWith('/rpc/remove_store_issue')) {
    const i = (state.issues ?? []).find((x) => x.id === body().p_issue)
    if (i) i.deleted_at = new Date().toISOString()
    return done(route.fulfill({ status: 204 }))
  }
  return undefined
}
