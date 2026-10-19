import { COMPANY, fakeToken, type FakeState, type Row } from './fake-supabase'

interface Ctx {
  path: string
  state: FakeState
  json: (body: unknown, status?: number) => Promise<void>
  body: () => Row
}

/** Invitations by email (both sides), and the super admin's panel. */
export async function handlePlatform({ path, state, json, body }: Ctx): Promise<true | undefined> {
  const send = async (b: unknown, status?: number) => {
    await json(b, status)
    return true as const
  }
  if (path.endsWith('/auth/v1/token')) {
    return send({ access_token: fakeToken, token_type: 'bearer', expires_in: 3600, expires_at: 9999999999, refresh_token: 'r', user: { id: 'u1', email: 'nora@example.com', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01' } })
  }
  if (path.endsWith('/rpc/my_invitations')) return send(state.invite?.mine ?? [])
  if (path.endsWith('/rpc/invitation_preview')) return send(state.invite?.preview ?? { state: 'invalid' })
  if (path.endsWith('/rpc/accept_invitation')) {
    const inv = (state.invite ??= {})
    if (inv.acceptError) return send({ message: inv.acceptError, code: '42501' }, 403)
    ;(inv.accepted ??= []).push(body())
    return send({ company_id: COMPANY, company: 'Panda', roles: ['merchandiser'] })
  }
  if (path.endsWith('/functions/v1/invitation')) {
    const inv = (state.invite ??= {})
    const b = body()
    if (b.action === 'signup') {
      if (inv.emailTaken) return send({ error: 'email_taken' }, 409)
      ;(inv.signups ??= []).push(b)
      return send({ email: inv.preview?.email ?? 'nora@example.com' })
    }
    if (b.action === 'resend') (inv.resent ??= []).push(String(b.invitationId))
    else (inv.created ??= []).push(b)
    const n = (inv.created?.length ?? 0) + (inv.resent?.length ?? 0)
    return send({ id: `inv-${n}`, link: `${String(b.origin)}/invitacion/tok-${n}-0123456789abcdef0123456789`, sent: inv.sent ?? true })
  }
  if (path.endsWith('/invitation')) return send(state.invite?.list ?? [])
  if (path.endsWith('/rpc/cancel_invitation')) {
    ;((state.invite ??= {}).canceled ??= []).push(String(body().p_invitation))
    return send(null)
  }
  if (path.endsWith('/support_access')) return send(state.supportLog ?? [])
  if (state.platform) {
    const pl = state.platform
    if (path.endsWith('/rpc/platform_companies')) return send(pl.companies)
    if (path.endsWith('/rpc/platform_totals')) return send([{ active_people: 11, photos: 900, photo_bytes: 2_600_000_000, db_bytes: 38_000_000, ai_captures: 104, ai_cost_usd_thousandths: 210 }])
    if (path.endsWith('/rpc/platform_new_company')) {
      const b = body()
      if (pl.companies.some((c) => String(c.name).toLowerCase() === String(b.p_name).toLowerCase())) return send({ message: 'A company with that name already exists', code: '23505' }, 409)
      ;(pl.created ??= []).push(b)
      const id = `new-${pl.companies.length}`
      pl.companies.push({ id, name: b.p_name, kind: b.p_kind, created_at: new Date().toISOString(), plan: b.p_plan, status: 'active', ends_on: b.p_ends_on, members: 0, invited: 0, admins: null, visits_30d: 0, last_activity_at: null, photos: 0, photo_bytes: 0, ai_captures: 0, ai_cost_usd_thousandths: 0, support_until: null })
      return send(id)
    }
    if (path.endsWith('/rpc/platform_set_plan')) {
      const b = body()
      const c = pl.companies.find((x) => x.id === b.p_company)
      if (c) Object.assign(c, { plan: b.p_plan, status: b.p_status, ends_on: b.p_ends_on })
      return send(null)
    }
    if (path.endsWith('/rpc/start_support')) {
      const b = body()
      const until = new Date(Date.now() + 2 * 3600_000).toISOString()
      ;(pl.sessions ??= []).push(b)
      const c = pl.companies.find((x) => x.id === b.p_company)
      if (c) c.support_until = until
      return send(until)
    }
    if (path.endsWith('/rpc/support_company')) {
      const c = pl.companies.find((x) => x.id === body().p_company)
      if (!c?.support_until) return send({ message: 'Open a support session first', code: '42501' }, 403)
      return send(pl.snapshot ?? { company: { name: c.name }, members: [], teams: [], days: [], catalogs: {}, sessions: [] })
    }
  }
  return undefined
}

