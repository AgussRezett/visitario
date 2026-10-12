import type { Page, Request } from '@playwright/test'

// A tiny in-memory stand-in for the Supabase endpoints the merchandiser's day uses.
// It is only as smart as the tests need: the real rules are tested in supabase/tests.

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
export const fakeToken = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', exp: 9999999999, aud: 'authenticated', role: 'authenticated' })}.c2ln`

export const COMPANY = 'c1'
export const ME = 'p1'

type Row = Record<string, unknown>

export interface FakeState {
  workday: Row | null
  visits: Row[]
  uploads: { bytes: Buffer; meta: Row }[]
}

export function visitRow(id: string, order: number, address: string, extra: Row = {}): Row {
  return {
    id, company_id: COMPANY, workday_id: 'w1', work_date: '2026-10-12', sort_order: order, task: null, source: 'added', added_by: ME,
    resumed_from: null, work_status: 'pending', review_status: 'unreviewed', arrived_at: null, consent: null, objection: null,
    retry_after: null, finished_at: null, notes: null, adder: { first_name: 'Agustín' },
    store: { id: `s-${id}`, name: null, address, area: null, customer_number: null, lat: null, lng: null, location_status: 'unverified' },
    display: [], photo: [], ...extra,
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

export async function installFakeSupabase(page: Page, state: FakeState) {
  await page.addInitScript((token) => {
    localStorage.setItem('visitario.activeRole', JSON.stringify({ companyId: 'c1', role: 'merchandiser' }))
    localStorage.setItem('sb-mjpzawlyjjlmluozjwap-auth-token', JSON.stringify({ access_token: token, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 9999999999, user: { id: 'u1' } }))
  }, fakeToken)

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
    if (path.endsWith('/person')) return json([{ id: ME, first_name: 'Agustín', last_name: 'Rezett' }])
    if (path.endsWith('/person_private')) return json({ dni: '35111222', phone: null, birth_date: null })
    if (path.endsWith('/platform_admin')) return json(null)
    if (path.endsWith('/membership')) {
      return json([{ id: 'm1', company_id: COMPANY, roles: ['merchandiser'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda' } }])
    }

    if (path.endsWith('/rpc/open_workday')) {
      state.workday = { id: 'w1', company_id: COMPANY, work_date: body().p_date, status: 'published', created_by: ME }
      return json('w1')
    }
    if (path.endsWith('/rpc/add_visit')) {
      const b = body()
      const id = `v${state.visits.length + 1}`
      state.visits.push(visitRow(id, state.visits.length, String(b.p_address)))
      return json(id)
    }
    if (path.endsWith('/rpc/resumable_visits') || path.endsWith('/rpc/search_stores')) return json([])
    if (path.endsWith('/workday')) {
      if (url.searchParams.get('select') === 'id, work_date') return json(state.workday ? [{ id: 'w1', work_date: state.workday.work_date }] : [])
      return json(state.workday ? [state.workday] : [])
    }
    if (path.endsWith('/visit')) {
      const id = url.searchParams.get('id')?.replace('eq.', '')
      if (req.method() === 'PATCH' && id) {
        const v = state.visits.find((x) => x.id === id)
        if (v) Object.assign(v, body())
        if (v && ['done', 'refused', 'closed'].includes(String(v.work_status))) v.finished_at = new Date().toISOString()
        return route.fulfill({ status: 204 })
      }
      return json(id ? state.visits.filter((v) => v.id === id) : state.visits)
    }
    if (path.endsWith('/functions/v1/photos')) {
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
