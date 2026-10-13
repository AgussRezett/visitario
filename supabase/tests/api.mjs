// The app's own queries, built with the same PostgREST client supabase-js uses, against a
// real PostgREST (started by api.sh). Every select with embeds is imported from the app.
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { PostgrestClient } from '@supabase/postgrest-js'
import { VISIT_SELECT, TEAM_VISIT_SELECT, COMMENT_SELECT } from '../../src/features/workday/api/selects.ts'

let passed = 0, failed = 0
const check = (name, ok, detail = '') => { ok ? passed++ : failed++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` → ${detail}`}`) }
const sql = (q) => execFileSync('psql', ['-h', 'localhost', '-p', process.env.PGPORT, '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAtc', q], { encoding: 'utf8' }).trim()

// ---- Fixtures (as the database owner)
const AUTH = '00000000-0000-7000-8000-0000000000aa', PERSON = '00000000-0000-7000-8000-0000000000a1', COMPANY = '00000000-0000-7000-8000-0000000000c1'
sql(`insert into auth.users (id, email) values ('${AUTH}', 'agus@example.com');
     insert into company (id, name, kind) values ('${COMPANY}', 'Panda', 'distributor');
     insert into person (id, auth_user_id, first_name, last_name) values ('${PERSON}', '${AUTH}', 'Agustín', 'Rezett');
     insert into person_private (person_id, dni) values ('${PERSON}', '34567890');
     insert into membership (company_id, person_id, roles, status) values ('${COMPANY}', '${PERSON}', '{merchandiser,admin}', 'active');
     insert into display_type (company_id, name) values ('${COMPANY}', 'Puntera');
     insert into brand (company_id, name) values ('${COMPANY}', 'SKYY');
     insert into work_metric (company_id, name, report_label) values ('${COMPANY}', 'Kits de bolsas', 'CUANTOS KIT DE BOLSAS ARME');`)
const typeId = Number(sql(`select id from display_type limit 1`))
const brandId = Number(sql(`select id from brand limit 1`))
const metricId = Number(sql(`select id from work_metric limit 1`))

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const head = b64({ alg: 'HS256', typ: 'JWT' })
const body = b64({ sub: AUTH, role: 'authenticated', exp: 9999999999 })
const sig = crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${head}.${body}`).digest('base64url')
const db = new PostgrestClient(process.env.API_URL, { headers: { Authorization: `Bearer ${head}.${body}.${sig}` } })
const ok = (name, r, extra = true) => check(name, !r.error && extra, r.error ? `${r.error.code} ${r.error.message}` : 'unexpected data')

// ---- Profile ("me")
ok('person by auth user', await db.from('person').select('id, first_name, last_name').eq('auth_user_id', AUTH).maybeSingle())
ok('own private data', await db.from('person_private').select('dni, phone, birth_date').eq('person_id', PERSON).single())
const ms = await db.from('membership').select('id, company_id, roles, status, starts_on, company:company_id (name)').eq('person_id', PERSON)
ok('memberships with company name', ms, ms.data?.[0]?.company?.name === 'Panda')
ok('has_password', await db.rpc('has_password'))

// ---- Workday
const wd = await db.rpc('open_workday', { p_company: COMPANY, p_date: '2026-10-12' })
ok('open_workday', wd)
const wid = wd.data
ok('workday by date', await db.from('workday').select('id, company_id, work_date, status, created_by').eq('company_id', COMPANY).eq('merchandiser_id', PERSON).eq('work_date', '2026-10-12').is('deleted_at', null).maybeSingle())
const v1 = await db.rpc('add_visit', { p_workday: wid, p_address: 'Moldes 1365', p_name: 'Autoservicio Lili', p_display_types: [typeId] })
ok('add_visit (new store with a display)', v1)
ok('add_visit (address only)', await db.rpc('add_visit', { p_workday: wid, p_address: 'Vidal 2044' }))
const list = await db.from('visit').select(VISIT_SELECT).eq('workday_id', wid).is('deleted_at', null).order('sort_order')
ok('visits of the day with store, displays and photos', list, list.data?.length === 2 && list.data[0].store?.address === 'Moldes 1365' && list.data[0].display.length === 1 && list.data[0].adder?.first_name === 'Agustín')
ok('one visit', await db.from('visit').select(VISIT_SELECT).eq('id', v1.data).maybeSingle())
ok('history', await db.from('workday').select('id, work_date').eq('company_id', COMPANY).eq('merchandiser_id', PERSON).is('deleted_at', null).order('work_date', { ascending: false }).limit(30))
ok('daily progress', await db.from('daily_progress').select('work_date, total, visited').eq('company_id', COMPANY).eq('merchandiser_id', PERSON))
ok('resumable visits', await db.rpc('resumable_visits', { p_company: COMPANY, p_before: '2026-10-13' }))
const found = await db.rpc('search_stores', { p_company: COMPANY, p_query: 'lili' })
ok('directory search', found, found.data?.length === 1)

// ---- Catalogs
for (const t of ['brand', 'display_type']) ok(`catalog ${t}`, await db.from(t).select('id, name').eq('company_id', COMPANY).eq('active', true).order('sort_order').order('name'))
ok('catalog work_metric', await db.from('work_metric').select('id, name, report_label').eq('company_id', COMPANY).eq('active', true).order('sort_order'))
ok('message templates', await db.from('message_template').select('kind, body').eq('company_id', COMPANY))

// ---- Visit work, as the visit sheet does it
const vid = v1.data
const disp = await db.from('display').insert({ company_id: COMPANY, visit_id: vid, display_type_id: typeId, source: 'found', sort_order: 1 }).select('id').single()
ok('add a found display', disp)
ok('display reference', await db.from('display').update({ reference: 'Pasillo 3' }).eq('id', disp.data?.id))
ok('photo row (as the photos function inserts it)', await db.from('photo').insert({ id: crypto.randomUUID(), company_id: COMPANY, visit_id: vid, kind: 'storefront', taken_at: new Date().toISOString(), bytes: 200000, width: 1400, height: 1050, created_by: PERSON }))
ok('arrive', await db.from('visit').update({ work_status: 'in_progress', arrived_at: new Date().toISOString() }).eq('id', vid))
ok('consent', await db.from('visit').update({ consent: 'with_objection', objection: 'Sin cartelería', retry_after: null }).eq('id', vid))
ok('metric upsert', await db.from('visit_metric').upsert({ company_id: COMPANY, visit_id: vid, metric_id: metricId, quantity: 2 }, { onConflict: 'visit_id,metric_id' }))
ok('metric upsert again', await db.from('visit_metric').upsert({ company_id: COMPANY, visit_id: vid, metric_id: metricId, quantity: 3 }, { onConflict: 'visit_id,metric_id' }))
ok('brand on', await db.from('visit_brand').upsert({ company_id: COMPANY, visit_id: vid, brand_id: brandId }, { onConflict: 'visit_id,brand_id', ignoreDuplicates: true }))
ok('brand on twice', await db.from('visit_brand').upsert({ company_id: COMPANY, visit_id: vid, brand_id: brandId }, { onConflict: 'visit_id,brand_id', ignoreDuplicates: true }))
const work = await Promise.all([db.from('visit_metric').select('metric_id, quantity').eq('visit_id', vid), db.from('visit_brand').select('brand_id').eq('visit_id', vid)])
ok('work read back', work[0], work[0].data?.[0]?.quantity === 3 && work[1].data?.length === 1)
ok('notes', await db.from('visit').update({ notes: 'Faltó SKYY' }).eq('id', vid))
ok('finish', await db.from('visit').update({ work_status: 'done' }).eq('id', vid))
const m = await db.from('daily_metrics').select('metric_id, quantity').eq('company_id', COMPANY).eq('merchandiser_id', PERSON).eq('work_date', '2026-10-12')
ok('day totals', m, m.data?.[0]?.quantity === 3)
ok('brand off', await db.from('visit_brand').delete().eq('visit_id', vid).eq('brand_id', brandId))
ok('soft-delete display', await db.from('display').update({ deleted_at: new Date().toISOString() }).eq('id', disp.data?.id))

// ---- The outbox re-sends changes after a lost answer: each must be harmless the second time
const offlineDisplay = crypto.randomUUID()
const addDisplay = () => db.from('display').upsert({ id: offlineDisplay, company_id: COMPANY, visit_id: vid, display_type_id: typeId, source: 'found', sort_order: 2 }, { onConflict: 'id', ignoreDuplicates: true })
ok('outbox: display created with the phone id', await addDisplay())
ok('outbox: same display sent again', await addDisplay())
const dCount = await db.from('display').select('id').eq('id', offlineDisplay)
ok('outbox: still one display', dCount, dCount.data?.length === 1)
const removeDisplay = () => db.from('display').update({ deleted_at: new Date().toISOString() }).eq('id', offlineDisplay).is('deleted_at', null)
ok('outbox: remove display', await removeDisplay())
ok('outbox: remove display again (no-op)', await removeDisplay())
ok('outbox: same visit patch twice', await db.from('visit').update({ notes: 'Faltó SKYY' }).eq('id', vid))

// ---- Stage 3: what the supervisor screens and the correction flow send
const tv = await db.from('visit').select(TEAM_VISIT_SELECT).eq('id', vid).single()
ok('team visit select (merchandiser embed)', tv, tv.data?.merchandiser?.first_name !== undefined)
const reply = { id: crypto.randomUUID(), company_id: COMPANY, visit_id: vid, display_id: null, author_id: PERSON, kind: 'reply', body: 'Ahora la saco' }
ok('outbox: reply comment', await db.from('comment').upsert(reply, { onConflict: 'id', ignoreDuplicates: true }))
ok('outbox: same reply again', await db.from('comment').upsert(reply, { onConflict: 'id', ignoreDuplicates: true }))
const cs = await db.from('comment').select(COMMENT_SELECT).eq('visit_id', vid).order('created_at')
ok('comments with author', cs, cs.data?.length === 1 && cs.data[0].author?.first_name !== undefined)
ok('events of a visit', await db.from('visit_event').select('id, kind, from_value, to_value, occurred_at, actor_id').eq('visit_id', vid).order('id'))
const td = await db.rpc('team_day', { p_company: COMPANY, p_date: '2026-10-12' })
ok('team_day', td, Array.isArray(td.data) && td.data.length >= 1)
ok('report_sync', await db.rpc('report_sync', { p_company: COMPANY, p_pending: 2, p_failed: 0, p_photos: 1 }))
const reviewCount = await db.from('visit').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY).eq('review_status', 'unreviewed').in('work_status', ['done', 'refused', 'closed'])
ok('review count (head)', reviewCount, typeof reviewCount.count === 'number')
ok('merchandiser_pending', await db.rpc('merchandiser_pending', { p_company: COMPANY, p_merchandiser: PERSON, p_before: '2026-10-20' }))

// ---- Stage 4: import, with the same request shapes as src/features/import/api/import.ts
const fmt = { name: 'Panda diaria', signature: 'cliente|domicilio|repositor', mapping: { hasHeader: true, columns: ['customer_number', 'address', 'merchandiser'], scope: 'caba', aliases: {} } }
const imp = await db.rpc('import_workdays', { p_company: COMPANY, p_date: '2026-10-23', p_rows: [{ merchandiser: PERSON, customer_number: '20990', address: 'Cabildo 2245', lat: -34.56, lng: -58.45, location_status: 'verified' }, { merchandiser: PERSON, address: 'Moldes 1365' }], p_format: fmt })
ok('import_workdays (Moldes 1365 already in the directory)', imp, imp.data?.visits === 2 && imp.data?.stores === 1)
const matched = await db.rpc('match_stores', { p_company: COMPANY, p_rows: [{ customer_number: '20990', address: 'otra' }, { customer_number: '', address: 'MOLDES 1365' }, { customer_number: '', address: 'Nada 1' }] })
ok('match_stores', matched, matched.data?.length === 2 && matched.data[0].matched_by === 'customer' && matched.data[1].idx === 1)
const formats = await db.from('import_format').select('id, name, signature, mapping, last_used_at').eq('company_id', COMPANY).order('last_used_at', { ascending: false, nullsFirst: false })
ok('import formats', formats, formats.data?.[0]?.name === 'Panda diaria' && formats.data[0].mapping.columns.length === 3)
const noFormat = await db.rpc('import_workdays', { p_company: COMPANY, p_date: '2026-10-23', p_rows: [{ merchandiser: PERSON, address: 'Moldes 1365' }], p_format: undefined })
ok('import_workdays without format, same store again', noFormat, noFormat.data?.visits === 0)

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
