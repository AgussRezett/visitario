import type { Request, Route } from '@playwright/test'
import { COMPANY, type FakeState, type Row } from './fake-supabase'

interface Ctx {
  path: string
  url: URL
  req: Request
  route: Route
  state: FakeState
  json: (body: unknown, status?: number) => Promise<void>
  body: () => Row
}

/** Admin and directory endpoints: people, teams, catalogs, company, templates, stores. Undefined when not handled. */
export async function handleAdmin({ path, url, req, route, state, json, body }: Ctx): Promise<true | undefined> {
  const done = async (p: Promise<void>) => {
    await p
    return true as const
  }
    // ---- Admin
    if (path.endsWith('/rpc/company_people')) return done(json(state.members ?? []))
    if (path.endsWith('/membership') && req.method() === 'PATCH') {
      const id = url.searchParams.get('id')?.replace('eq.', '')
      const m = (state.members ?? []).find((x) => x.membership_id === id)
      if (m) Object.assign(m, body())
      return done(json({ id }))
    }
    if (path.endsWith('/team')) {
      const id = url.searchParams.get('id')?.replace('eq.', '')
      if (req.method() === 'POST') {
        const t = { id: `t${(state.teams ??= []).length + 1}`, ...body() }
        state.teams.push(t)
        return done(json({ id: t.id }))
      }
      if (req.method() === 'PATCH') {
        Object.assign((state.teams ?? []).find((t) => t.id === id) ?? {}, body())
        return done(json({ id }))
      }
      if (req.method() === 'DELETE') {
        state.teams = (state.teams ?? []).filter((t) => t.id !== id)
        ;(state.members ?? []).forEach((m) => { if (m.team_id === id) m.team_id = null })
        return done(json([{ id }]))
      }
      return done(json(state.teams ?? []))
    }
    if (path.endsWith('/company') && state.company) {
      if (req.method() === 'PATCH') {
        const patch = Object.fromEntries(Object.entries(body()).filter(([, v]) => v !== undefined))
        Object.assign(state.company, patch)
        // The company's look also reaches who I am, as my_identity returns it.
        const look = Object.fromEntries(Object.entries(patch).filter(([k]) => k === 'brand_color' || k === 'logo_path'))
        for (const m of state.memberships ?? []) if (m.company_id === COMPANY && m.company) Object.assign(m.company as Row, look)
        return done(json([{ id: state.company.id ?? COMPANY }]))
      }
      const one = (req.headers().accept ?? '').includes('vnd.pgrst.object')
      return done(json(one ? state.company : [state.company]))
    }
    // ---- Directory
    if (path.endsWith('/rpc/store_directory') || path.endsWith('/rpc/store_directory_v2')) {
      const b = body()
      const tag = (value: unknown, wanted: unknown) => wanted === undefined || wanted === null || (wanted === 0 ? !value : value === wanted)
      const q = String(b.p_query ?? '').toLowerCase()
      const rows = (state.stores ?? []).filter((x) => (b.p_filter === 'archived' ? Boolean(x.deleted_at) && !x.merged_into && !x.removed_at : !x.deleted_at))
        .filter((x) => !q || `${x.name ?? ''} ${x.address} ${x.customer_number ?? ''}`.toLowerCase().includes(q))
        .filter((x) => b.p_filter !== 'unverified' || x.location_status !== 'verified')
        .filter((x) => b.p_filter !== 'added' || x.source === 'merchandiser')
        .filter((x) => tag(x.channel_id, b.p_channel) && tag(x.seller_id, b.p_seller))
        .filter((x) => !b.p_area || x.area === b.p_area)
      return done(json(rows.map((x) => ({
        channel_id: x.channel_id ?? null, seller_id: x.seller_id ?? null,
        id: x.id, name: x.name ?? null, address: x.address, area: x.area ?? null, customer_number: x.customer_number ?? null,
        location_status: x.location_status ?? 'unverified', source: x.source ?? 'manual', created_by_name: x.created_by_name ?? null,
        last_visit_date: x.last_visit_date ?? null, last_visit_status: x.last_visit_date ? 'done' : null, last_visit_review: x.last_visit_date ? 'approved' : null,
        last_merchandiser: x.last_visit_date ? 'Lucía' : null, visits_30d: x.visits_30d ?? 0, total: rows.length,
      }))))
    }
    if (path.endsWith('/rpc/store_directory_counts')) {
      const live = (state.stores ?? []).filter((x) => !x.deleted_at)
      return done(json([{ total: live.length, unverified: live.filter((x) => x.location_status !== 'verified').length, added: live.filter((x) => x.source === 'merchandiser').length, areas: [...new Set(live.map((x) => x.area).filter(Boolean))] }]))
    }
    if (path.endsWith('/rpc/seller_stores')) return done(json(state.clients ?? []))
    if (path.endsWith('/rpc/store_open_stops_count')) return done(json(state.openStops?.[String(body().p_store)] ?? 0))
    if (path.endsWith('/rpc/remove_store')) {
      const found = (state.stores ?? []).find((x) => x.id === body().p_store)
      if (!found?.deleted_at) return done(json({ code: '23514', message: 'Only an archived store can be removed' }, 400))
      found.removed_at = new Date().toISOString()
      return done(route.fulfill({ status: 204 }))
    }
    if (path.endsWith('/rpc/merge_stores')) {
      const b = body()
      const drop = (state.stores ?? []).find((x) => x.id === b.p_drop)
      const keep = (state.stores ?? []).find((x) => x.id === b.p_keep)
      if (drop && keep) {
        drop.deleted_at = new Date().toISOString()
        drop.merged_into = keep.id
        keep.customer_number ??= drop.customer_number
      }
      const moved = state.visits.filter((v) => v.store_id === b.p_drop)
      moved.forEach((v) => { v.store_id = b.p_keep })
      return done(json(moved.length))
    }
    if (path.endsWith('/store') && state.stores) {
      const id = url.searchParams.get('id')?.replace('eq.', '')
      const found = state.stores.find((x) => x.id === id)
      if (req.method() === 'HEAD') {
        const n = state.stores.filter((x) => x.deleted_at && !x.merged_into && !x.removed_at).length // the "Archivados" count
        return done(route.fulfill({ status: 200, headers: { 'content-range': `*/${n}`, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' } }))
      }
      if (req.method() === 'PATCH') {
        const patch = Object.fromEntries(Object.entries(body()).filter(([, v]) => v !== undefined))
        // Many at once: id=in.(a,b), answering the rows changed.
        const many = url.searchParams.get('id')?.match(/^in\.\((.*)\)$/)?.[1]?.split(',')
        if (many) {
          const changed = state.stores.filter((x) => many.includes(String(x.id)) && !x.removed_at)
          changed.forEach((x) => Object.assign(x, patch))
          state.bulkUpdates = [...(state.bulkUpdates ?? []), { ids: changed.map((x) => String(x.id)), patch }]
          return done(json(changed.map((x) => ({ id: x.id }))))
        }
        Object.assign(found ?? {}, patch)
        return done(route.fulfill({ status: 204 }))
      }
      if (id) {
        const row = found ? { company_id: COMPANY, created_at: '2026-10-01T12:00:00Z', source: 'manual', lat: null, lng: null, location_status: 'unverified', creator: null, deleted_at: null, merged_into: null, removed_at: null, ...found } : null
        const one = (req.headers().accept ?? '').includes('vnd.pgrst.object')
        return done(one ? json(row) : json(row ? [row] : []))
      }
    }
    if (path.endsWith('/subscription')) return done(json(state.subscription ?? null))
    if (path.endsWith('/rpc/company_usage')) return done(json(state.usage ? [state.usage] : []))
    if (path.endsWith('/message_template')) {
      if (req.method() === 'POST') {
        const b = body()
        state.templates = [...(state.templates ?? []).filter((t) => t.kind !== b.kind), b]
        return done(route.fulfill({ status: 201 }))
      }
      return done(json(state.templates ?? []))
    }
    const table = (['brand', 'display_type', 'work_metric', 'channel', 'seller'] as const).find((t) => path.endsWith(`/${t}`))
    if (table && state.catalogs) {
      const list = (state.catalogs[table] ??= [])
      const id = Number(url.searchParams.get('id')?.replace('eq.', ''))
      if (req.method() === 'POST') {
        const b = body()
        if (list.some((x) => x.name === b.name)) return done(json({ code: '23505', message: `duplicate key value violates unique constraint "${table}_company_id_name_key"` }, 409))
        const row = { id: list.length + 100, active: true, group_name: null, report_label: null, sort_order: 0, person_id: null, ...b }
        list.push(row)
        // insert(...).select().single() wants the row back
        return done(url.searchParams.has('select') ? json(row, 201) : route.fulfill({ status: 201 }))
      }
      if (req.method() === 'PATCH') {
        Object.assign(list.find((x) => x.id === id) ?? {}, body())
        return done(route.fulfill({ status: 204 }))
      }
      return done(json(list))
    }
    if (path.endsWith('/import_format') && req.method() !== 'GET') {
      const id = url.searchParams.get('id')?.replace('eq.', '')
      if (req.method() === 'DELETE') state.formats = (state.formats ?? []).filter((f) => f.id !== id)
      else Object.assign((state.formats ?? []).find((f) => f.id === id) ?? {}, body())
      return done(route.fulfill({ status: 204 }))
    }
    if (path.endsWith('/rpc/find_person_by_dni')) {
      const p = state.dnis?.[String(body().p_dni)]
      return done(json(p ? [p] : []))
    }
    if (path.endsWith('/rpc/invite_person')) {
      const b = body()
      const known = state.dnis?.[String(b.p_dni)]
      const id = `m${(state.members ??= []).length + 1}`
      state.members.push({
        membership_id: id, person_id: known?.person_id ?? `p-${b.p_dni}`, first_name: known?.first_name ?? b.p_first_name, last_name: known?.last_name ?? b.p_last_name,
        roles: b.p_roles, team_id: b.p_team ?? null, status: 'invited', starts_on: b.p_starts_on, phone_last4: String(b.p_phone ?? known?.phone_last4 ?? '').slice(-4) || null,
        last_activity_at: null, invited_at: new Date().toISOString(),
      })
      return done(json(id))
    }

  return undefined
}
