import type { Page, Request } from '@playwright/test'
import { handleAdmin } from './fake-admin'
import { handlePlatform } from './fake-platform'
import { handleOperation } from './fake-operation'
import type { FakeState, Row } from './fake-state'

export type { FakeState, Row } from './fake-state'

// A tiny in-memory stand-in for the Supabase endpoints the merchandiser's day uses.
// It is only as smart as the tests need: the real rules are tested in supabase/tests.

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
export const fakeToken = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', exp: 9999999999, aud: 'authenticated', role: 'authenticated' })}.c2ln`

/** The day the merchandiser's fixtures are written for: those tests run as if it were today. */
export const FAKE_TODAY = '2026-10-12'
export const atFakeToday = (page: Page) => page.clock.setFixedTime(new Date(`${FAKE_TODAY}T12:00:00-03:00`))

export const COMPANY = 'c1'
export const ME = 'p1'


export function visitRow(id: string, order: number, address: string, extra: Row = {}): Row {
  return {
    id, company_id: COMPANY, workday_id: 'w1', work_date: '2026-10-12', sort_order: order, task: null, source: 'added', added_by: ME,
    resumed_from: null, work_status: 'pending', review_status: 'unreviewed', arrived_at: null, consent: null, objection: null,
    retry_after: null, finished_at: null, notes: null, adder: { first_name: 'Agustín' },
    store: { id: `s-${id}`, name: null, address, area: null, customer_number: null, lat: null, lng: null, location_status: 'unverified' },
    display: [], photo: [], merchandiser_id: ME, merchandiser: { first_name: 'Agustín', last_name: 'Rezett' }, reviewed_at: null, updated_at: '2026-10-12T15:00:00Z', ...extra,
  }
}

/** The JPEG part of a multipart body. */
function filePart(req: Request) {
  const body = req.postDataBuffer() ?? Buffer.alloc(0)
  const start = body.indexOf(Buffer.from([0xff, 0xd8, 0xff]))
  const end = body.lastIndexOf(Buffer.from([0xff, 0xd9]))
  const metaMatch = /name="meta"\r\n\r\n(\{.*?\})\r\n/s.exec(body.toString('latin1'))
  return { bytes: body.subarray(start, end + 2), meta: JSON.parse(metaMatch?.[1] ?? '{}') as Row }
}

/** PostgREST filters the app uses: eq, neq, in, is.null. */
function matches(row: Row, params: URLSearchParams) {
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue
    const value = row[key]
    if (raw.startsWith('eq.') && String(value) !== raw.slice(3)) return false
    if (raw.startsWith('neq.') && String(value) === raw.slice(4)) return false
    if (raw.startsWith('in.(') && !raw.slice(4, -1).split(',').map((x) => x.replace(/"/g, '')).includes(String(value))) return false
    if (raw === 'is.null' && value != null) return false
  }
  return true
}

export async function installFakeSupabase(page: Page, state: FakeState, role: 'merchandiser' | 'supervisor' | 'admin' = 'merchandiser') {
  await page.addInitScript(([token, r, offer]) => {
    localStorage.setItem('visitario.activeRole', JSON.stringify({ companyId: 'c1', role: r }))
    // The install guide opens by itself a few seconds in; only its own tests want it.
    if (!offer && !localStorage.getItem('visitario.install')) localStorage.setItem('visitario.install', JSON.stringify({ dismissedAt: null, dismissals: 3 }))
    // A test can end the session for good (as if the phone's site data were cleared).
    if (!localStorage.getItem('e2e.noSession')) localStorage.setItem('sb-mjpzawlyjjlmluozjwap-auth-token', JSON.stringify({ access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 9999999999, user: { id: 'u1' } }))
  }, [fakeToken, role, Boolean(state.installOffer)] as const)

  await page.route('**/*.supabase.co/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body })
    const body = () => (req.postDataJSON() ?? {}) as Row

    if (path.endsWith('/auth/v1/user')) {
      return json({ id: 'u1', email: 'agus@example.com', identities: [{ provider: 'email' }], aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01' })
    }
    if (path.endsWith('/rpc/has_password')) return json(true)
    if (path.endsWith('/person')) return json(state.invite?.noPerson ? [] : [{ id: ME, first_name: 'Agustín', last_name: 'Rezett' }])
    if (path.endsWith('/person_private')) return json({ dni: '35111222', phone: null, birth_date: null })
    if (path.endsWith('/platform_admin')) return json(state.platform ? { person_id: ME } : null)
    const platform = await handlePlatform({ path, state, json, body })
    if (platform) return platform
    const handled = await handleAdmin({ path, url, req, route, state, json, body })
    if (handled) return handled
    const operation = await handleOperation({ path, url, state, json, body })
    if (operation) return operation
    if (path.endsWith('/membership')) {
      return json(state.memberships ?? [{ id: 'm1', company_id: COMPANY, roles: ['merchandiser'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda' } }])
    }

    // ---- Supervisor side
    if (path.endsWith('/rpc/report_sync')) {
      ;(state.reports ??= []).push(body())
      return json(null)
    }
    if (path.endsWith('/rpc/request_fix')) {
      const b = body()
      ;(state.comments ??= []).push({ id: `c${state.comments.length + 1}`, visit_id: b.p_visit, display_id: b.p_display ?? null, author_id: ME, kind: 'fix_request', body: b.p_body, created_at: new Date().toISOString(), author: { first_name: 'Agustín', last_name: 'Rezett' } })
      const v = state.visits.find((x) => x.id === b.p_visit)
      if (v) v.review_status = 'needs_fix'
      return json(null)
    }
    if (path.endsWith('/rpc/team_day')) {
      const date = String(body().p_date)
      return json((state.people ?? []).map((p) => {
        const wd = (state.workdays ?? []).find((w) => w.merchandiser_id === p.id && w.work_date === date)
        const vs = state.visits.filter((v) => v.merchandiser_id === p.id && v.work_date === date && (!wd || v.workday_id === wd.id))
        const n = (f: (v: Row) => boolean) => vs.filter(f).length
        return {
          person_id: p.id, first_name: p.first_name, last_name: p.last_name, workday_id: wd?.id ?? null, workday_status: wd?.status ?? null,
          total: vs.length, visited: n((v) => ['done', 'refused', 'closed'].includes(String(v.work_status))), in_progress: n((v) => v.work_status === 'in_progress'),
          refused: n((v) => v.work_status === 'refused'), closed: n((v) => v.work_status === 'closed'), approved: n((v) => v.review_status === 'approved'),
          needs_fix: n((v) => v.review_status === 'needs_fix'), to_review: n((v) => v.review_status === 'unreviewed' && ['done', 'refused', 'closed'].includes(String(v.work_status))),
          last_activity_at: p.last_activity_at ?? null, last_place: p.last_place ?? null, sync_pending: p.sync_pending ?? 0, sync_failed: 0, sync_photos: p.sync_photos ?? 0, sync_reported_at: p.sync_reported_at ?? null,
        }
      }))
    }
    if (path.endsWith('/rpc/plan_workday')) {
      const b = body()
      const found = (state.workdays ??= []).find((w) => w.merchandiser_id === b.p_merchandiser && w.work_date === b.p_date)
      if (found) return json(found.id)
      const w = { id: `w-${b.p_merchandiser}-${b.p_date}`, company_id: COMPANY, merchandiser_id: b.p_merchandiser, work_date: b.p_date, status: 'draft' }
      state.workdays.push(w)
      return json(w.id)
    }
    if (path.endsWith('/rpc/merchandiser_pending')) return json(state.pending ?? [])
    if (path.endsWith('/rpc/resume_visit')) { (state.resumed ??= []).push(String(body().p_visit)); return json('r') }
    if (path.endsWith('/comment')) {
      if (req.method() === 'POST') {
        ;(state.comments ??= []).push({ ...body(), created_at: new Date().toISOString(), author: { first_name: 'Agustín', last_name: 'Rezett' } })
        return route.fulfill({ status: 201 })
      }
      return json((state.comments ?? []).filter((c) => matches(c, url.searchParams)))
    }
    if (path.endsWith('/visit_event')) return json([])

    // ---- Import
    if (path.endsWith('/import_format')) return json((state.formats ?? []).filter((f) => matches(f, url.searchParams)))
    if (path.endsWith('/rpc/match_stores')) {
      const norm = (t: unknown) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
      const rows = body().p_rows as Row[]
      return json(rows.flatMap((r, idx) => {
        const byCustomer = r.customer_number ? (state.stores ?? []).find((x) => x.customer_number === r.customer_number) : undefined
        const byAddress = (state.stores ?? []).find((x) => norm(x.address) === norm(r.address))
        const s = byCustomer ?? byAddress
        return s ? [{ idx, store_id: s.id, name: s.name ?? null, address: s.address, area: s.area ?? null, customer_number: s.customer_number ?? null, location_status: 'verified', matched_by: byCustomer ? 'customer' : 'address' }] : []
      }))
    }
    if (path.endsWith('/rpc/import_workdays')) {
      const b = body()
      const rows = b.p_rows as Row[]
      const plans = new Set<string>()
      let stores = 0
      for (const r of rows) {
        let storeId = r.store as string | undefined
        if (!storeId) {
          storeId = `s-new-${(state.stores ??= []).length + 1}`
          state.stores.push({ id: storeId, address: r.address, customer_number: r.customer_number ?? null, name: r.name ?? null, area: r.area ?? null, lat: r.lat ?? null, source: 'imported' })
          stores++
        }
        const wid = `w-${r.merchandiser}-${b.p_date}`
        if (!(state.workdays ??= []).some((w) => w.id === wid)) state.workdays.push({ id: wid, company_id: COMPANY, merchandiser_id: r.merchandiser, work_date: b.p_date, status: 'draft' })
        plans.add(wid)
        state.visits.push(visitRow(`v${state.visits.length + 1}`, state.visits.length, String(r.address ?? storeId), { workday_id: wid, work_date: b.p_date, merchandiser_id: r.merchandiser, source: 'assigned', task: r.task ?? null, store_id: storeId }))
      }
      if (b.p_format) {
        const f = b.p_format as Row
        state.formats = [...(state.formats ?? []).filter((x) => x.signature !== f.signature), { id: `f${(state.formats ?? []).length + 1}`, company_id: COMPANY, ...f, last_used_at: new Date().toISOString() }]
      }
      return json({ workdays: plans.size, visits: rows.length, stores })
    }
    if (path.endsWith('/functions/v1/read-capture')) {
      if (!state.capture || state.capture.status) return json({ error: 'fake' }, state.capture?.status ?? 503)
      return json({ rows: state.capture.rows ?? [], unreadable: state.capture.unreadable ?? 0, model: 'fake' })
    }
    if (path.endsWith('/daily_metrics')) return json((state.dailyMetrics ?? []).filter((r) => matches(r, url.searchParams)))
    if (path.endsWith('/functions/v1/route')) {
      ;(state.routeAsked ??= []).push(body())
      return state.route ? json(state.route) : json({ error: 'not_configured' }, 503)
    }
    if (path.endsWith('/functions/v1/geocode')) {
      const q = String(body().query)
      const hit = state.geocode?.[q]
      return json({ results: hit ? [hit] : [] })
    }

    if (path.endsWith('/rpc/open_workday')) {
      state.workday = { id: 'w1', company_id: COMPANY, work_date: body().p_date, status: 'published', created_by: ME }
      return json('w1')
    }
    if (path.endsWith('/rpc/add_visit')) {
      const b = body()
      const id = `v${state.visits.length + 1}`
      const planned = (state.workdays ?? []).find((w) => w.id === b.p_workday)
      const store = { store_id: b.p_store ?? `s-${id}` }
      state.visits.push(visitRow(id, state.visits.length, String(b.p_address), planned ? { ...store, workday_id: planned.id, work_date: planned.work_date, merchandiser_id: planned.merchandiser_id, source: 'assigned', task: b.p_task ?? null } : store))
      return json(id)
    }
    if (path.endsWith('/rpc/tag_store')) {
      ;(state.tagged ??= []).push(body())
      return route.fulfill({ status: 204 })
    }
    if (path.endsWith('/rpc/store_reputation')) {
      const ids = (body().p_stores as string[]) ?? []
      return json((state.reputation ?? []).filter((r) => ids.includes(String(r.store_id))))
    }
    if (path.endsWith('/rpc/rapport_facts')) {
      const b = body()
      const from = new Date(`${String(b.p_from)}T12:00:00Z`)
      from.setUTCDate(from.getUTCDate() - 6) // a fact's week can start before the period
      return json((state.rapportFacts ?? []).filter((f) => String(f.week) >= from.toISOString().slice(0, 10) && String(f.week) <= String(b.p_to)))
    }
    if (path.endsWith('/rpc/resumable_visits')) return json(state.resumable ?? [])
    if (path.endsWith('/rpc/dismiss_resumable')) {
      const ids = (body().p_visits as string[]) ?? []
      ;(state.dismissed ??= []).push(...ids)
      state.resumable = (state.resumable ?? []).filter((r) => !ids.includes(String(r.visit_id)))
      return json(ids.length)
    }
    if (path.endsWith('/rpc/search_stores')) return json((state.stores ?? []).filter((x) => `${x.name ?? ''} ${x.address}`.toLowerCase().includes(String(body().p_query).toLowerCase())))
    if (path.endsWith('/workday') && req.method() === 'PATCH') {
      const changed = (state.workdays ?? []).filter((w) => matches(w, url.searchParams))
      changed.forEach((w) => Object.assign(w, body()))
      return json(changed.map((w) => ({ id: w.id })))
    }
    if (path.endsWith('/workday') && url.searchParams.has('merchandiser_id') && state.workdays) {
      return json(state.workdays.filter((w) => matches(w, url.searchParams)))
    }
    if (path.endsWith('/workday')) {
      if (url.searchParams.get('select') === 'id, work_date') return json(state.workday ? [{ id: 'w1', work_date: state.workday.work_date }] : [])
      const wanted = url.searchParams.get('work_date')?.replace('eq.', '')
      if (state.workdayDelayMs && wanted) await new Promise((resolve) => setTimeout(resolve, state.workdayDelayMs))
      return json(state.workday && (!wanted || wanted === state.workday.work_date) ? [state.workday] : [])
    }
    if (path.endsWith('/visit')) {
      const id = url.searchParams.get('id')?.replace('eq.', '')
      if (req.method() === 'PATCH' && id) {
        const v = state.visits.find((x) => x.id === id)
        if (v) Object.assign(v, body())
        if (v?.deleted_at) state.visits = state.visits.filter((x) => x !== v)
        if (v && ['done', 'refused', 'closed'].includes(String(v.work_status))) v.finished_at = new Date().toISOString()
        return route.fulfill({ status: 204 })
      }
      const found = state.visits.filter((v) => matches(v, url.searchParams))
      if (url.searchParams.get('order')?.startsWith('sort_order')) found.sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
      if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'content-range': `*/${found.length}`, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' } })
      return json((req.headers().accept ?? '').includes('vnd.pgrst.object') ? (found[0] ?? null) : found)
    }
    if (path.endsWith('/functions/v1/photos')) {
      if (state.uploadDelayMs) await new Promise((resolve) => setTimeout(resolve, state.uploadDelayMs))
      if (state.photoStatus) return json({ error: 'fake' }, state.photoStatus)
      const { bytes, meta } = filePart(req)
      state.uploads.push({ bytes, meta })
      const v = state.visits.find((x) => x.id === meta.visitId)
      const now = new Date().toISOString()
      ;(v?.photo as Row[] | undefined)?.push({ id: meta.id, kind: meta.kind, display_id: meta.displayId, taken_at: now, uploaded_at: now, deleted_at: null })
      if (v && meta.kind === 'storefront' && v.work_status === 'pending') Object.assign(v, { work_status: 'in_progress', arrived_at: now }) // like the sync_arrival trigger
      return json({ id: meta.id, uploaded: true })
    }
    if (path.endsWith('/functions/v1/photos/urls')) return json({ urls: {} })
    if (path.endsWith('/display_type')) return json([{ id: 1, name: 'Puntera' }, { id: 3, name: 'Góndola' }])
    if (path.endsWith('/message_template')) return json([])
    return json([])
  })
}
