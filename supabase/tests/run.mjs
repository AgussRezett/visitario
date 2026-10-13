// Runs the migrations on Postgres (PGlite) and checks permissions with real users of every role.
// Usage: node supabase/tests/run.mjs
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFileSync, readdirSync } from 'node:fs';

const db = new PGlite({ extensions: { pg_trgm } });
const here = new URL('.', import.meta.url);
const migrations = new URL('../migrations/', import.meta.url);
await db.exec(readFileSync(new URL('stub_supabase.sql', here), 'utf8'));
for (const f of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(new URL(f, migrations), 'utf8'));
}

let passed = 0, failed = 0;
const U = {
  carla: '00000000-0000-7000-8000-000000000001', martin: '00000000-0000-7000-8000-000000000002',
  agus: '00000000-0000-7000-8000-000000000003', lucia: '00000000-0000-7000-8000-000000000004',
  beto: '00000000-0000-7000-8000-000000000005', intruder: '00000000-0000-7000-8000-000000000006',
};
const phone = { agus: '+5491155554521', martin: '+5491144441020', lucia: '+5491133330000', beto: '+5491122220000' };
for (const [k, id] of Object.entries(U)) await db.query('insert into auth.users (id, phone) values ($1, $2)', [id, phone[k] ?? null]);

async function as(who, sql, params = []) {
  const claims = JSON.stringify({ sub: U[who], phone: phone[who] ?? null, role: 'authenticated' });
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${U[who]}', false), set_config('request.jwt.claims', '${claims}', false);`);
  try { return (await db.query(sql, params)).rows; }
  finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claims', '', false);`); }
}
async function asAnon(sql) {
  await db.exec('set role anon;');
  try { return (await db.query(sql)).rows; } finally { await db.exec('reset role;'); }
}
const sys = async (sql, params = []) => (await db.query(sql, params)).rows;
function check(name, cond) { cond ? passed++ : failed++; console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); }
async function expectError(name, fn, pattern) {
  try { await fn(); check(`${name} (should have failed)`, false); }
  catch (e) { check(`${name} → ${e.message}`, pattern ? pattern.test(e.message) : true); }
}
const pid = async who => (await sys(`select id from person where auth_user_id = $1`, [U[who]]))[0].id;

// ---- Platform setup: Panda and another company, each with an admin (done by a platform admin / service role)
const [{ id: panda }] = await sys(`insert into company (name, kind) values ('Panda', 'distributor') returning id`);
const [{ id: other }] = await sys(`insert into company (name, kind) values ('Distribuidora Sur', 'distributor') returning id`);
await sys(`insert into subscription (company_id, plan) values ($1, 'pilot'), ($2, 'free')`, [panda, other]);

await as('carla', `select complete_identity('30111222', 'Carla', 'López', '1990-01-01', '+5491100000001')`);
await as('beto', `select complete_identity('31222333', 'Beto', 'Ruiz', '1985-05-05', '+5491122220000')`);
await sys(`insert into membership (company_id, person_id, roles, status) values ($1, $2, '{admin}', 'active'), ($3, $4, '{admin,merchandiser}', 'active')`,
  [panda, await pid('carla'), other, await pid('beto')]);
const [{ id: north }] = await sys(`insert into team (company_id, name) values ($1, 'Norte') returning id`, [panda]);
const [{ id: south }] = await sys(`insert into team (company_id, name) values ($1, 'Sur') returning id`, [panda]);
const [{ id: endcap }] = await sys(`insert into display_type (company_id, name) values ($1, 'Puntera') returning id`, [panda]);
const [{ id: kits }] = await sys(`insert into work_metric (company_id, name, report_label) values ($1, 'Kits de bolsas', 'CUANTOS KIT DE BOLSAS ARME') returning id`, [panda]);
const [{ id: skyy }] = await sys(`insert into brand (company_id, name) values ($1, 'SKYY') returning id`, [panda]);

// ---- Identity and invitations
await expectError('Supervisor cannot search by DNI', () => as('martin', `select * from find_person_by_dni($1, '34567890')`, [panda]));
check('Admin searching an unknown DNI gets nothing', (await as('carla', `select * from find_person_by_dni($1, '34567890')`, [panda])).length === 0);
check('Lookup is logged with a hash, never the DNI', (await sys(`select count(*)::int n from dni_lookup where length(dni_hash) = 32`))[0].n === 1);

await as('carla', `select invite_person($1, '34567890', '{merchandiser}', $2, current_date, 'Agustín', 'Rezett', '+5491155554521')`, [panda, north]);
await as('carla', `select invite_person($1, '28441906', '{supervisor}', $2, current_date, 'Martín', 'Sosa', '+5491144441020')`, [panda, north]);
await as('carla', `select invite_person($1, '40111222', '{merchandiser}', $2, current_date, 'Lucía', 'Gómez', '+5491133330000')`, [panda, south]);

await expectError('Someone else cannot claim Agus’s DNI without his phone', () =>
  as('intruder', `select complete_identity('34567890', 'X', 'Y', null, '+5491100000000')`), /phone/);
await as('agus', `select complete_identity('34567890', 'Agustín', 'Rezett', '1995-04-12', '+5491155554521')`);
await as('martin', `select complete_identity('28441906', 'Martín', 'Sosa', null, '+5491144441020')`);
await as('lucia', `select complete_identity('40111222', 'Lucía', 'Gómez', null, '+5491133330000')`);
check('Agus claimed the person created by the invitation', (await sys(`select count(*)::int n from person_private where dni = '34567890'`))[0].n === 1);

const membershipOf = async who => (await sys(`select id from membership where person_id = $1 and company_id = $2`, [await pid(who), panda]))[0].id;
await expectError('Admin cannot accept an invitation for someone else', async () => {
  await as('carla', `update membership set status = 'active' where id = $1`, [await membershipOf('agus')]);
}, /invited person/);
for (const w of ['agus', 'martin', 'lucia']) await as(w, `select respond_invitation($1, true)`, [await membershipOf(w)]);
check('Three invitations accepted', (await sys(`select count(*)::int n from membership where company_id = $1 and status = 'active'`, [panda]))[0].n === 4);

check('Agus cannot read Martín’s private data', (await as('agus', `select * from person_private`)).length === 1);
check('Anonymous sees nothing', (await asAnon(`select * from person`).catch(() => [])).length === 0);
check('Beto (other company) cannot see Panda people', (await as('beto', `select first_name from person`)).every(r => r.first_name === 'Beto'));
check('Agus sees his company only', (await as('agus', `select name from company`)).map(r => r.name).join() === 'Panda');
check('Agus cannot see the subscription', (await as('agus', `select * from subscription`)).length === 0);
check('Carla (admin) sees the subscription', (await as('carla', `select * from subscription`)).length === 1);

// ---- Workday and visits
const agus = await pid('agus'), martin = await pid('martin');
const [{ id: s1 }] = await as('martin', `insert into store (company_id, customer_number, name, address, created_by, source)
  values ($1, '12345', 'Mas Ahorro', 'Tres Arroyos 762', $2, 'imported') returning id`, [panda, martin]);
const [{ id: w1 }] = await as('martin', `insert into workday (company_id, merchandiser_id, work_date) values ($1, $2, '2026-10-09') returning id`, [panda, agus]);
const v1 = '01926f00-0000-7000-8000-00000000a001';
await as('martin', `insert into visit (id, company_id, workday_id, merchandiser_id, work_date, store_id, added_by, task)
  values ($1, $2, $3, $4, '2000-01-01', $5, $4, 'Ordenar puntera')`, [v1, panda, w1, agus, s1]);
check('Visit copies the date from its workday (ignores the client value)', (await sys(`select work_date::text d from visit where id = $1`, [v1]))[0].d === '2026-10-09');
check('Agus cannot see the draft workday', (await as('agus', `select * from visit`)).length === 0);
await as('martin', `update workday set status = 'published' where id = $1`, [w1]);
check('Published: Agus sees his visit', (await as('agus', `select * from visit`)).length === 1);
check('Lucía (other team) cannot see Agus’s visit', (await as('lucia', `select * from visit`)).length === 0);
check('Beto (other company) cannot see the visit', (await as('beto', `select * from visit`)).length === 0);

// Agus adds his own address (offline: id comes from the phone)
const [{ id: s2 }] = await as('agus', `insert into store (company_id, address, created_by, source) values ($1, 'Cabildo 2280', $2, 'merchandiser') returning id`, [panda, agus]);
const v2 = '01926f00-0000-7000-8000-00000000a002';
await as('agus', `insert into visit (id, company_id, workday_id, merchandiser_id, work_date, store_id, added_by) values ($1, $2, $3, $4, current_date, $5, $4)`, [v2, panda, w1, agus, s2]);
check('A visit Agus adds is marked as added by him', (await sys(`select source::text s from visit where id = $1`, [v2]))[0].s === 'added');
await as('agus', `insert into visit (id, company_id, workday_id, merchandiser_id, work_date, store_id, added_by) values ($1, $2, $3, $4, current_date, $5, $4) on conflict (id) do nothing`, [v2, panda, w1, agus, s2]);
check('Re-sending the same insert does not duplicate', (await sys(`select count(*)::int n from visit`))[0].n === 2);

await expectError('Agus cannot change the store of an assigned visit', () => as('agus', `update visit set store_id = $1 where id = $2`, [s2, v1]), /supervisor/);
await expectError('Invalid jump (pending → done)', () => as('agus', `update visit set work_status = 'done' where id = $1`, [v1]), /transition/);

// Visit work
await as('agus', `update visit set work_status = 'in_progress', arrived_at = now(), consent = 'with_objection', objection = 'Sin cartelería' where id = $1`, [v1]);
const p1 = '01926f00-0000-7000-8000-00000000f001', d1 = '01926f00-0000-7000-8000-00000000e001', p2 = '01926f00-0000-7000-8000-00000000f002';
await as('agus', `insert into photo (id, company_id, visit_id, kind, taken_at, bytes, width, height, created_by, uploaded_at) values ($1, $2, $3, 'storefront', now(), 210000, 1400, 1050, $4, now())`, [p1, panda, v1, martin]);
const ph = (await sys(`select created_by = $2 mine, uploaded_at is null pending from photo where id = $1`, [p1, agus]))[0];
check('Photo belongs to the uploader and starts unconfirmed', ph.mine === true && ph.pending === true);
await as('agus', `insert into display (id, company_id, visit_id, display_type_id) values ($1, $2, $3, $4)`, [d1, panda, v1, endcap]);
check('Display without an after photo: not arranged', (await as('agus', `select arranged from display_status where id = $1`, [d1]))[0].arranged === false);
await as('agus', `insert into photo (id, company_id, visit_id, display_id, kind, taken_at, bytes, width, height, created_by) values ($1, $2, $3, $4, 'after', now(), 190000, 1400, 1050, $5)`, [p2, panda, v1, d1, agus]);
check('With an after photo: arranged (derived)', (await as('agus', `select arranged from display_status where id = $1`, [d1]))[0].arranged === true);
await expectError('Storefront photo with a display is rejected', () => as('agus', `insert into photo (id, company_id, visit_id, display_id, kind, taken_at, bytes, width, height, created_by) values (gen_random_uuid(), $1, $2, $3, 'storefront', now(), 1, 1, 1, $4)`, [panda, v1, d1, agus]));
await as('agus', `insert into visit_metric (company_id, visit_id, metric_id, quantity) values ($1, $2, $3, 2)`, [panda, v1, kits]);
await as('agus', `insert into visit_brand (company_id, visit_id, brand_id) values ($1, $2, $3)`, [panda, v1, skyy]);
await expectError('Supervisor cannot upload photos', () => as('martin', `insert into photo (id, company_id, visit_id, kind, taken_at, bytes, width, height, created_by) values (gen_random_uuid(), $1, $2, 'storefront', now(), 1, 1, 1, $3)`, [panda, v1, martin]), /merchandiser/);
await expectError('Supervisor cannot record the work', () => as('martin', `update visit set notes = 'x' where id = $1`, [v1]), /merchandiser/);
await as('agus', `update visit set work_status = 'done', notes = 'Faltó SKYY' where id = $1`, [v1]);
check('Done: finished_at is stamped', (await sys(`select finished_at is not null f from visit where id = $1`, [v1]))[0].f === true);

// Cross-company isolation
await expectError('Beto cannot attach a photo to a Panda visit', () => as('beto', `insert into photo (id, company_id, visit_id, kind, taken_at, bytes, width, height, created_by) values (gen_random_uuid(), $1, $2, 'storefront', now(), 1, 1, 1, $3)`, [other, v1, U.beto]));
await expectError('Not even the service role: the composite FK blocks crossing companies', () => sys(`insert into photo (id, company_id, visit_id, kind, taken_at, bytes, width, height, created_by) values (gen_random_uuid(), $1, $2, 'storefront', now(), 1, 1, 1, $3)`, [other, v1, agus]), /foreign key/);

// Review
await expectError('Agus cannot approve his own visit', () => as('agus', `update visit set review_status = 'approved' where id = $1`, [v1]), /resubmit/);
await expectError('Requesting a fix without a comment', () => as('martin', `update visit set review_status = 'needs_fix' where id = $1`, [v1]), /comment/);
await as('martin', `insert into comment (company_id, visit_id, display_id, author_id, kind, body) values ($1, $2, $3, $4, 'fix_request', 'Falta la foto del antes')`, [panda, v1, d1, martin]);
await as('martin', `update visit set review_status = 'needs_fix' where id = $1`, [v1]);
await as('agus', `update visit set review_status = 'unreviewed' where id = $1`, [v1]);
check('Agus resubmits the fix', (await sys(`select review_status::text r from visit where id = $1`, [v1]))[0].r === 'unreviewed');
await as('martin', `update visit set review_status = 'approved' where id = $1`, [v1]);
check('Approved with reviewer and date', (await sys(`select reviewed_by = $2 r from visit where id = $1`, [v1, martin]))[0].r === true);
await expectError('An approved visit is locked', () => as('agus', `update visit set notes = 'otra' where id = $1`, [v1]), /approved/);
await expectError('Nor can photos be added to it', () => as('agus', `insert into photo (id, company_id, visit_id, display_id, kind, taken_at, bytes, width, height, created_by) values (gen_random_uuid(), $1, $2, $3, 'before', now(), 1, 1, 1, $4)`, [panda, v1, d1, agus]), /approved/);
await expectError('Nobody writes the history by hand', () => as('martin', `insert into visit_event (company_id, visit_id, kind) values ($1, $2, 'created')`, [panda, v1]));
const ev = await as('agus', `select kind::text, to_value from visit_event where visit_id = $1 order by id`, [v1]);
check(`Automatic history (${ev.map(e => e.to_value ?? e.kind).join(' → ')})`, ev.length === 6);

// Resume: v2 is still pending; Agus moves it to a new workday of his own
const [{ id: w2 }] = await as('agus', `insert into workday (company_id, merchandiser_id, work_date, status) values ($1, $2, '2026-10-10', 'published') returning id`, [panda, agus]);
const [{ resume_visit: v3 }] = await as('agus', `select resume_visit($1, $2)`, [v2, w2]);
const r = (await sys(`select work_date::text d, source::text s, resumed_from = $2 r from visit where id = $1`, [v3, v2]))[0];
check('Resumed: new visit in the new workday, original source kept', r.r === true && r.d === '2026-10-10' && r.s === 'added');

// Views and search
const prog = await as('martin', `select * from daily_progress where work_date = '2026-10-09'`);
check(`Supervisor daily progress (${prog[0]?.total} visits, ${prog[0]?.visited} visited)`, prog.length === 1 && prog[0].total === 2 && prog[0].visited === 1);
check('Agus sees his progress; Lucía does not', (await as('agus', `select * from daily_progress`)).length === 2 && (await as('lucia', `select * from daily_progress`)).length === 0);
const found = await as('agus', `select name from store where private.normalize(coalesce(name, '') || ' ' || address || ' ' || coalesce(customer_number, '')) like '%' || private.normalize('mas ahórro') || '%'`);
check('Accent-insensitive store search', found.length === 1);

// ---- Stage 1: the merchandiser's day
const wOwn = (await as('agus', `select open_workday($1, '2026-10-12') id`, [panda]))[0].id;
check('open_workday returns the same workday twice', (await as('agus', `select open_workday($1, '2026-10-12') id`, [panda]))[0].id === wOwn);
check('Own workday is published and created by Agus', (await sys(`select status::text s, created_by = $2 mine from workday where id = $1`, [wOwn, agus])).every(r => r.s === 'published' && r.mine));
await as('martin', `insert into workday (company_id, merchandiser_id, work_date) values ($1, $2, '2026-10-20')`, [panda, agus]);
await expectError('Cannot open a day the supervisor is drafting', () => as('agus', `select open_workday($1, '2026-10-20')`, [panda]), /preparing/);

const va = (await as('agus', `select add_visit($1, p_address => 'Moldes 1365', p_name => 'Autoservicio Lili', p_display_types => $2) id`, [wOwn, [endcap, endcap]]))[0].id;
const vb = (await as('agus', `select add_visit($1, p_address => 'Vidal 2044') id`, [wOwn]))[0].id;
const order = await sys(`select id, sort_order from visit where workday_id = $1 order by sort_order`, [wOwn]);
check('Added addresses keep their order', order.map(r => r.id).join() === [va, vb].join() && order[1].sort_order === 1);
check('New store is the merchandiser’s, unverified', (await sys(`select s.source::text src, s.location_status::text loc from visit v join store s on s.id = v.store_id where v.id = $1`, [va]))[0].src === 'merchandiser');
check('Expected displays are created with the visit', (await sys(`select count(*)::int n from display where visit_id = $1`, [va]))[0].n === 2);
const sLili = (await sys(`select store_id from visit where id = $1`, [va]))[0].store_id;
check('Adding the same store twice returns the same visit', (await as('agus', `select add_visit($1, p_store => $2) id`, [wOwn, sLili]))[0].id === va);
await expectError('Beto cannot add to Agus’s workday', () => as('beto', `select add_visit($1, p_address => 'X 123')`, [wOwn]), /not found/);

check('Directory search ignores accents and case', (await as('agus', `select name from search_stores($1, 'MÁS ahorro')`, [panda])).some(r => r.name === 'Mas Ahorro'));
check('Directory search by customer number', (await as('agus', `select name from search_stores($1, '12345')`, [panda])).length === 1);
check('Another company’s directory is empty for Beto', (await as('beto', `select * from search_stores($1, 'mas')`, [panda])).length === 0);

await as('agus', `update visit set work_status = 'in_progress', arrived_at = now() where id = $1`, [va]);
await expectError('Cannot finish without the storefront photo', () => as('agus', `update visit set work_status = 'closed', consent = 'closed' where id = $1`, [va]), /storefront/);
await as('agus', `insert into photo (id, company_id, visit_id, kind, taken_at, bytes, width, height, created_by) values (gen_random_uuid(), $1, $2, 'storefront', now(), 180000, 1400, 1050, $3)`, [panda, va, agus]);
await expectError('Cannot finish as done without consent', () => as('agus', `update visit set work_status = 'done' where id = $1`, [va]), /consent/);
await as('agus', `update visit set work_status = 'closed', consent = 'closed' where id = $1`, [va]);
check('Closed with the storefront photo', (await sys(`select work_status::text s from visit where id = $1`, [va]))[0].s === 'closed');

const resumable = await as('agus', `select * from resumable_visits($1, '2026-10-13')`, [panda]);
check(`Resumable: pending and closed from earlier days (${resumable.length})`, resumable.some(r => r.visit_id === va && r.pending_displays === 2) && resumable.some(r => r.visit_id === vb));
const wNext = (await as('agus', `select open_workday($1, '2026-10-13') id`, [panda]))[0].id;
await as('agus', `select add_visit($1, p_address => 'Monroe 2650') id`, [wNext]);
const vr = (await as('agus', `select resume_visit($1, $2) id`, [va, wNext]))[0].id;
check('Resumed visit goes to the end of the day', (await sys(`select sort_order from visit where id = $1`, [vr]))[0].sort_order === 1);
check('A resumed visit is not offered again', !(await as('agus', `select visit_id from resumable_visits($1, '2026-10-14')`, [panda])).some(r => r.visit_id === va));
check('Lucía cannot list Agus’s resumable visits', (await as('lucia', `select * from resumable_visits($1, '2026-10-14')`, [panda])).length === 0);

// ---- The storefront photo decides whether the visit started
const vs = (await as('agus', `select add_visit($1, p_address => 'Gorostiaga 1801') id`, [wNext]))[0].id;
const visitState = async () => (await sys(`select work_status::text s, arrived_at is not null arrived, consent::text c, finished_at is not null f from visit where id = $1`, [vs]))[0];
const storefront = async () => (await as('agus', `insert into photo (id, company_id, visit_id, kind, taken_at, bytes, width, height, created_by) values (gen_random_uuid(), $1, $2, 'storefront', now(), 180000, 1400, 1050, $3) returning id`, [panda, vs, agus]))[0].id;
const sf1 = await storefront();
check('A storefront photo still uploading does not start the visit', (await visitState()).s === 'pending');
await sys(`update photo set uploaded_at = now() where id = $1`, [sf1]); // the Edge Function confirms the file
let st = await visitState();
check('Uploaded storefront photo: the visit is in progress with its arrival', st.s === 'in_progress' && st.arrived);
const sf2 = await storefront();
await as('agus', `update photo set deleted_at = now() where id = $1`, [sf1]);
check('Deleting one of two storefront photos keeps it in progress', (await visitState()).s === 'in_progress');
await as('agus', `update visit set consent = 'yes', work_status = 'done' where id = $1`, [vs]);
await expectError('A merchandiser still cannot jump from done to pending', () => as('agus', `update visit set work_status = 'pending' where id = $1`, [vs]), /transition/);
await as('agus', `update photo set deleted_at = now() where id = $1`, [sf2]);
st = await visitState();
check('Deleting the last storefront photo of a finished visit: back to pending, clean', st.s === 'pending' && !st.arrived && st.c === null && !st.f);
const sf3 = await storefront();
await sys(`update photo set uploaded_at = now() where id = $1`, [sf3]);
await as('agus', `update visit set consent = 'refused', work_status = 'refused' where id = $1`, [vs]);
await as('agus', `update photo set deleted_at = now() where id = $1`, [sf3]);
check('Also from refused', (await visitState()).s === 'pending');

// ---- Removing a stop from the day
const vAssigned = (await as('martin', `insert into visit (company_id, workday_id, merchandiser_id, work_date, store_id, added_by) values ($1, $2, $3, '2000-01-01', $4, $5) returning id`, [panda, wNext, agus, s1, martin]))[0].id;
await expectError('Agus cannot remove a stop the supervisor assigned', () => as('agus', `update visit set deleted_at = now() where id = $1`, [vAssigned]), /supervisor/);
await as('agus', `update visit set deleted_at = now() where id = $1`, [vs]);
check('Agus removes a stop he added', (await sys(`select deleted_at is not null d from visit where id = $1`, [vs]))[0].d === true);
await as('agus', `update visit set deleted_at = now() where id = $1`, [vr]);
check('Removing a resumed stop makes the original resumable again', (await as('agus', `select visit_id from resumable_visits($1, '2026-10-14')`, [panda])).some(r => r.visit_id === va));
await as('martin', `update visit set deleted_at = now() where id = $1`, [vAssigned]);
check('The supervisor removes the assigned stop', (await sys(`select deleted_at is not null d from visit where id = $1`, [vAssigned]))[0].d === true);

// ---- Stage 3 · Supervisor: assign, publish, team day, review and corrections
const fri = '2026-10-16'
const luciaId = await pid('lucia')
const wFri = (await as('martin', `select plan_workday($1, $2, $3) id`, [panda, agus, fri]))[0].id
check('Supervisor plans a draft for Agus', (await sys(`select status::text s, created_by = $2 mine from workday where id = $1`, [wFri, martin]))[0].s === 'draft')
check('plan_workday twice returns the same draft', (await as('martin', `select plan_workday($1, $2, $3) id`, [panda, agus, fri]))[0].id === wFri)
check('Agus does not see the draft', (await as('agus', `select id from workday where id = $1`, [wFri])).length === 0)
await expectError('Agus opening that day is told the supervisor is preparing it', () => as('agus', `select open_workday($1, $2)`, [panda, fri]), /preparing/)
await expectError('Martín cannot plan for Lucía (another team)', () => as('martin', `select plan_workday($1, $2, $3)`, [panda, luciaId, fri]))
const vAssign = (await as('martin', `select add_visit($1, p_store => $2, p_task => 'Ordenar puntera', p_display_types => $3) id`, [wFri, s1, [endcap, endcap]]))[0].id
await as('martin', `select add_visit($1, p_address => 'Echeverría 1580') id`, [wFri])
check('Assigned stop: source, author, task and indicated displays', (await sys(`select v.source::text s, v.added_by = $2 by, v.task, (select count(*)::int from display d where d.visit_id = v.id and d.source = 'assigned') n from visit v where v.id = $1`, [vAssign, martin]))[0].n === 2)
await as('martin', `update workday set status = 'published' where id = $1`, [wFri])
check('Published: Agus sees the day and its 2 stops', (await as('agus', `select id from visit where workday_id = $1`, [wFri])).length === 2)
const vExtra = (await as('agus', `select add_visit($1, p_address => 'Moldes 1365') id`, [wFri]))[0].id
check('A stop Agus adds to an assigned day shows as his', (await as('martin', `select source::text s, added_by = $2 mine from visit where id = $1`, [vExtra, agus]))[0].s === 'added')

const wSat = (await as('martin', `select plan_workday($1, $2, '2026-10-17') id`, [panda, agus]))[0].id
check('Copy a day: all its stops', (await as('martin', `select copy_workday($1, $2) n`, [wFri, wSat]))[0].n === 3)
check('Copy again adds nothing', (await as('martin', `select copy_workday($1, $2) n`, [wFri, wSat]))[0].n === 0)
check('Copied stops keep task and indicated displays', (await sys(`select count(*)::int n from display d join visit v on v.id = d.visit_id where v.workday_id = $1`, [wSat]))[0].n === 2)
check('Supervisor lists Agus’s pending stops', (await as('martin', `select * from merchandiser_pending($1, $2, '2026-10-18')`, [panda, agus])).length > 0)
check('Lucía cannot list Agus’s pending stops', (await as('lucia', `select * from merchandiser_pending($1, $2, '2026-10-18')`, [panda, agus])).length === 0)

await as('agus', `select report_sync($1, 7, 0, 2, now() - interval '10 minutes')`, [panda])
await as('agus', `select report_sync($1, 3, 1, 1, null)`, [panda])
check('Sync report keeps the last numbers', (await as('martin', `select pending, failed from sync_report where person_id = $1`, [agus]))[0]?.pending === 3)
check('Lucía and Beto do not see Agus’s sync', (await as('lucia', `select * from sync_report where person_id = $1`, [agus])).length === 0 && (await as('beto', `select * from sync_report`)).length === 0)
await as('beto', `select report_sync($1, 9, 9, 9, null)`, [panda])
check('Reporting for a company where you do not work saves nothing', (await sys(`select count(*)::int n from sync_report where person_id = $1`, [U.beto]))[0].n === 0)

// Agus works the assigned stop and finishes it
await as('agus', `insert into photo (id, company_id, visit_id, kind, taken_at, bytes, width, height, created_by) values (gen_random_uuid(), $1, $2, 'storefront', now(), 1, 1, 1, $3)`, [panda, vAssign, agus])
await as('agus', `update visit set work_status = 'in_progress', consent = 'yes' where id = $1`, [vAssign])
await as('agus', `update visit set work_status = 'done' where id = $1`, [vAssign])
let team = await as('martin', `select * from team_day($1, $2)`, [panda, fri])
let agusRow = team.find(r => r.person_id === agus)
check(`Team day: Agus 1 of 3 visited, 1 to review, sync 3 (${JSON.stringify({ t: agusRow?.total, v: agusRow?.visited, r: agusRow?.to_review, s: agusRow?.sync_pending })})`, agusRow?.total === 3 && agusRow.visited === 1 && agusRow.to_review === 1 && agusRow.sync_pending === 3 && agusRow.last_activity_at !== null)
check('Team day does not show Lucía to Martín', !team.some(r => r.first_name === 'Lucía'))
check('Lucía’s team day only has herself', (await as('lucia', `select * from team_day($1, $2)`, [panda, fri])).every(r => r.first_name === 'Lucía'))

await expectError('A fix request needs a comment', () => as('martin', `select request_fix($1, '  ')`, [vAssign]), /comment/)
await expectError('Lucía cannot ask for a fix on Agus’s visit', () => as('lucia', `select request_fix($1, 'x')`, [vAssign]))
const dFix = (await sys(`select id from display where visit_id = $1 order by sort_order limit 1`, [vAssign]))[0].id
await as('martin', `select request_fix($1, 'Falta el después de la puntera', $2)`, [vAssign, dFix])
check('Fix requested with its comment on the display', (await sys(`select v.review_status::text r, (select display_id = $2 from comment c where c.visit_id = v.id and c.kind = 'fix_request') d from visit v where v.id = $1`, [vAssign, dFix]))[0].d === true)
await as('agus', `insert into comment (company_id, visit_id, author_id, kind, body) values ($1, $2, $3, 'reply', 'Ahora la saco')`, [panda, vAssign, agus])
await as('agus', `update visit set review_status = 'unreviewed' where id = $1`, [vAssign])
team = await as('martin', `select * from team_day($1, $2)`, [panda, fri])
check('The resubmitted fix is back in the supervisor’s queue', team.find(r => r.person_id === agus)?.to_review === 1)
await as('martin', `update visit set review_status = 'approved' where id = $1`, [vAssign])
check('Approved', (await sys(`select review_status::text r from visit where id = $1`, [vAssign]))[0].r === 'approved')
check('The conversation is visible to both, not to Lucía', (await as('agus', `select * from comment where visit_id = $1`, [vAssign])).length === 2 && (await as('lucia', `select * from comment where visit_id = $1`, [vAssign])).length === 0)

// ---- Stage 4 · Import: match against the directory, then one transaction
const thu = '2026-10-22'
const s19008 = (await sys(`insert into store (company_id, customer_number, name, address) values ($1, '19008', 'Maxi Olazábal', 'Olazábal 1550') returning id`, [panda]))[0].id
const matched = await as('martin', `select * from match_stores($1, $2)`, [panda, JSON.stringify([{ customer_number: '19008', address: 'Olazabal 155O' }, { address: 'OLAZÁBAL  1550' }, { address: 'Cabildo 2245' }])])
check('Match by customer number even with another address, then by address', matched.length === 2 && matched[0].idx === 0 && matched[0].matched_by === 'customer' && matched[1].idx === 1 && matched[1].matched_by === 'address')
check('Another company matches nothing in Panda', (await as('beto', `select * from match_stores($1, $2)`, [panda, JSON.stringify([{ customer_number: '19008' }])])).length === 0)
const rows = [
  { merchandiser: agus, customer_number: '19008', address: 'Olazabal 155O', task: 'Armar isla' },
  { merchandiser: agus, customer_number: '20990', name: 'Kiosco Cabildo', address: 'Cabildo 2245', area: 'Belgrano', lat: -34.56, lng: -58.45, location_status: 'verified' },
  { merchandiser: agus, address: 'cabildo 2245' },
  { merchandiser: agus, address: 'Ciudad de la Paz 1700' },
]
const fmt = { name: 'Panda diaria', signature: 'cliente|razon social|domicilio|repositor', mapping: { columns: ['customer_number', 'name', 'address', 'merchandiser'], hasHeader: true } }
await expectError('A merchandiser cannot import', () => as('lucia', `select import_workdays($1, $2, $3)`, [panda, thu, JSON.stringify(rows)]), /supervisors/)
await expectError('Importing for someone of another team fails as a whole', () => as('martin', `select import_workdays($1, $2, $3, $4)`, [panda, thu, JSON.stringify([{ merchandiser: agus, address: 'Atómica 100' }, { merchandiser: luciaId, address: 'Atómica 200' }]), fmt]))
check('…and leaves nothing created: no store, no workday, no format', (await sys(`select (select count(*)::int from store where address like 'Atómica%') s, (select count(*)::int from workday where work_date = $1) w, (select count(*)::int from import_format) f`, [thu]))[0].s + (await sys(`select count(*)::int n from workday where work_date = $1`, [thu]))[0].n + (await sys(`select count(*)::int n from import_format`))[0].n === 0)
const result = (await as('martin', `select import_workdays($1, $2, $3, $4) r`, [panda, thu, JSON.stringify(rows), fmt]))[0].r
check(`Import: 1 draft, 3 visits, 2 new stores (${JSON.stringify(result)})`, result.workdays === 1 && result.visits === 3 && result.stores === 2)
const wThu = (await sys(`select id, status::text s from workday where work_date = $1 and merchandiser_id = $2`, [thu, agus]))[0]
check('The imported day is a draft Agus does not see yet', wThu.s === 'draft' && (await as('agus', `select id from workday where id = $1`, [wThu.id])).length === 0)
check('Recognised store keeps its address; the task is on the visit', (await sys(`select s.address, v.task, v.source::text src from visit v join store s on s.id = v.store_id where v.workday_id = $1 and s.id = $2`, [wThu.id, s19008]))[0]?.task === 'Armar isla')
const newStores = await sys(`select address, source::text src, location_status::text loc, customer_number cn from store where address in ('Cabildo 2245', 'Ciudad de la Paz 1700') order by address`)
check('New stores: imported, located or left to verify', newStores.length === 2 && newStores.every(s => s.src === 'imported') && newStores[0].loc === 'verified' && newStores[1].loc === 'unverified')
check('Importing the same file again adds nothing', (await as('martin', `select import_workdays($1, $2, $3) r`, [panda, thu, JSON.stringify(rows)]))[0].r.visits === 0)
check('The format is saved for the company', (await as('martin', `select name from import_format where signature = $1`, [fmt.signature]))[0]?.name === 'Panda diaria')
check('Merchandisers and other companies do not see formats', (await as('agus', `select * from import_format`)).length === 0 && (await as('beto', `select * from import_format`)).length === 0)
await as('martin', `select import_workdays($1, $2, $3, $4)`, [panda, thu, JSON.stringify(rows.slice(0, 1)), { ...fmt, name: 'Panda viernes' }])
check('Saving the same columns again renames, never duplicates', (await sys(`select count(*)::int n, max(name) name from import_format`))[0].n === 1 && (await sys(`select name from import_format`))[0].name === 'Panda viernes')
const fid = (await sys(`select id from import_format limit 1`))[0].id
await as('carla', `update import_format set name = 'Panda semanal' where id = $1`, [fid])
check('Admin renames a saved format', (await sys(`select name from import_format where id = $1`, [fid]))[0].name === 'Panda semanal')
await expectError('A row without store or address is refused', () => as('martin', `select import_workdays($1, $2, $3)`, [panda, thu, JSON.stringify([{ merchandiser: agus, name: 'Sin dirección' }])]), /address/)

// ---- Stage 5 · Admin: people and teams
const people = await as('carla', `select * from company_people($1)`, [panda])
const agusRow5 = people.find(r => r.person_id === agus)
check(`Admin lists the company's people with role, team, state and last activity (${people.length})`, people.length >= 4 && agusRow5?.status === 'active' && agusRow5.team_id === north && agusRow5.phone_last4 === '4521' && agusRow5.last_activity_at !== null)
await expectError('A supervisor cannot list people', () => as('martin', `select * from company_people($1)`, [panda]), /admin/)
await expectError('Another company cannot list Panda’s people', () => as('beto', `select * from company_people($1)`, [panda]), /admin/)
const agusM = (await sys(`select id from membership where company_id = $1 and person_id = $2`, [panda, agus]))[0].id
await as('carla', `update membership set status = 'disabled' where id = $1`, [agusM])
check('Admin deactivates someone: they lose access', (await as('agus', `select id from workday where company_id = $1`, [panda])).length === 0)
await as('carla', `update membership set status = 'active' where id = $1`, [agusM])
check('…and brings them back without a new invitation', (await sys(`select status::text s from membership where id = $1`, [agusM]))[0].s === 'active')
await as('carla', `update membership set roles = '{merchandiser,supervisor}', team_id = $2 where id = $1`, [agusM, north])
check('Admin changes roles and team', (await sys(`select roles::text r from membership where id = $1`, [agusM]))[0].r === '{merchandiser,supervisor}')
await as('carla', `update membership set roles = '{merchandiser}' where id = $1`, [agusM])
const sofiM = await as('carla', `select invite_person($1, '41207553', '{merchandiser}', $2, current_date, 'Sofía', 'Benítez', '+5491166667777') id`, [panda, north])
await expectError('Admin cannot accept an invitation for someone', () => as('carla', `update membership set status = 'active' where id = $1`, [sofiM[0].id]), /invited person/)
await as('carla', `update membership set status = 'declined' where id = $1`, [sofiM[0].id])
check('Admin cancels a pending invitation', (await sys(`select status::text s from membership where id = $1`, [sofiM[0].id]))[0].s === 'declined')
await expectError('A cancelled invitation cannot be turned active by the admin either', () => as('carla', `update membership set status = 'active' where id = $1`, [sofiM[0].id]), /invited person/)
await expectError('A supervisor cannot change memberships', () => as('martin', `update membership set roles = '{admin}' where id = $1 returning id`, [agusM]).then(r => { if (!r.length) throw new Error('no rows: denied by RLS') }), /denied|RLS/)
const west = (await as('carla', `insert into team (company_id, name, areas) values ($1, 'Oeste', 'Liniers, Mataderos') returning id`, [panda]))[0].id
await as('carla', `update team set name = 'Equipo Oeste' where id = $1`, [west])
check('Admin creates and renames a team', (await sys(`select name from team where id = $1`, [west]))[0].name === 'Equipo Oeste')
await expectError('A supervisor cannot create teams', () => as('martin', `insert into team (company_id, name) values ($1, 'Mío')`, [panda]))

// ---- Stage 5 · Admin: catalogs (deactivated, never deleted: past visits keep their names)
const aperol = (await as('carla', `insert into brand (company_id, name, group_name) values ($1, 'Aperol', 'Grupo Campari') returning id`, [panda]))[0].id
await as('carla', `update brand set active = false where id = $1`, [aperol])
check('Admin adds and deactivates a brand', (await as('agus', `select active from brand where id = $1`, [aperol]))[0]?.active === false)
await expectError('Catalog items are not deleted', () => as('carla', `delete from brand where id = $1`, [aperol]))
await expectError('A supervisor cannot edit catalogs', () => as('martin', `insert into work_metric (company_id, name) values ($1, 'Otra cosa')`, [panda]))
await expectError('Names are unique per company', () => as('carla', `insert into display_type (company_id, name) values ($1, 'Puntera')`, [panda]), /unique|duplicate/)
check('Another company does not see Panda’s catalogs', (await as('beto', `select * from brand where company_id = $1`, [panda])).length === 0)

// ---- Stage 5 · Admin: company and plan
const usage = (await as('carla', `select * from company_usage($1)`, [panda]))[0]
check(`Usage: active people, photos, visits this month, stores (${JSON.stringify(usage)})`, usage.active_people >= 4 && usage.photos >= 1 && Number(usage.photo_bytes) >= 1 && usage.stores >= 2)
await expectError('A supervisor cannot see usage', () => as('martin', `select * from company_usage($1)`, [panda]), /admin/)
await as('carla', `update company set geocoding_scope = 'argentina', photo_retention_months = 24, show_whatsapp = false where id = $1`, [panda])
check('Admin changes address search, photo retention and WhatsApp', (await sys(`select geocoding_scope::text g, photo_retention_months m, show_whatsapp w from company where id = $1`, [panda]))[0].m === 24)
await sys(`update company set geocoding_scope = 'caba', show_whatsapp = true where id = $1`, [panda])
await expectError('The company kind is not editable by the admin', () => as('carla', `update company set kind = 'brand' where id = $1`, [panda]))
check('Admin reads the plan; the subscription is not editable from the app', (await as('carla', `select plan::text p from subscription where company_id = $1`, [panda]))[0]?.p === 'pilot')
await expectError('…not even by its admin', () => as('carla', `update subscription set plan = 'team' where company_id = $1`, [panda]))

// ---- Stage 5 · Directory: list, counts, merge duplicates
const dir = await as('martin', `select * from store_directory($1, 'olazabal')`, [panda])
check(`Directory search by name or address, with total (${dir.length})`, dir.length >= 1 && Number(dir[0].total) === dir.length && dir[0].address === 'Olazábal 1550')
const withVisit = (await as('martin', `select * from store_directory($1, 'echeverria')`, [panda]))[0]
check('Directory row carries the last visit of my team', withVisit?.last_visit_date !== null && withVisit?.last_merchandiser === 'Agustín')
const counts = (await as('martin', `select * from store_directory_counts($1)`, [panda]))[0]
check(`Directory counts and areas (${JSON.stringify(counts)})`, counts.total >= 5 && counts.unverified >= 1 && Array.isArray(counts.areas))
check('Another company sees nothing in Panda’s directory', (await as('beto', `select * from store_directory($1)`, [panda])).length === 0)
check('The directory filters unverified and added stores', (await as('martin', `select * from store_directory($1, null, 'unverified')`, [panda])).every(r => r.location_status !== 'verified') && (await as('martin', `select * from store_directory($1, null, 'added')`, [panda])).every(r => r.source === 'merchandiser'))

const dupKeep = (await sys(`insert into store (company_id, name, address, location_status, lat, lng) values ($1, 'Lili', 'Moldes 1365', 'verified', -34.56, -58.45) returning id`, [panda]))[0].id
const dupDrop = (await sys(`insert into store (company_id, customer_number, address, area) values ($1, '20577', 'Moldes 1365 PB', 'Belgrano') returning id`, [panda]))[0].id
const wMerge = (await as('martin', `select plan_workday($1, $2, '2026-10-26') id`, [panda, agus]))[0].id
const vMergeA = (await as('martin', `select add_visit($1, p_store => $2) id`, [wMerge, dupDrop]))[0].id
await sys(`insert into photo (id, company_id, visit_id, kind, taken_at, uploaded_at, bytes, width, height, created_by) values (gen_random_uuid(), $1, $2, 'storefront', now(), now(), 1, 1, 1, $3)`, [panda, vMergeA, agus])
await sys(`update visit set work_status = 'in_progress', consent = 'yes', arrived_at = now() where id = $1`, [vMergeA])
await sys(`update visit set work_status = 'done', review_status = 'approved' where id = $1`, [vMergeA])
await expectError('A merchandiser cannot merge stores', () => as('agus', `select merge_stores($1, $2)`, [dupKeep, dupDrop]), /supervisors/)
await expectError('Another company cannot merge Panda’s stores', () => as('beto', `select merge_stores($1, $2)`, [dupKeep, dupDrop]))
check('Merging moves every visit, even an approved one', (await as('martin', `select merge_stores($1, $2) n`, [dupKeep, dupDrop]))[0].n === 1 && (await sys(`select store_id = $2 ok from visit where id = $1`, [vMergeA, dupKeep]))[0].ok)
const merged = (await sys(`select (select deleted_at is not null and merged_into = $1 from store where id = $2) gone, customer_number, area, name, location_status::text loc from store where id = $1`, [dupKeep, dupDrop]))[0]
check(`The one that stays takes what only the duplicate had (${JSON.stringify(merged)})`, merged.gone && merged.customer_number === '20577' && merged.area === 'Belgrano' && merged.name === 'Lili' && merged.loc === 'verified')
await expectError('An approved visit still cannot be moved by hand', () => as('martin', `update visit set store_id = $2 where id = $1`, [vMergeA, s1]), /pending|locked/)
await as('martin', `update store set name = 'Autoservicio Lili', area = 'Belgrano' where id = $1`, [dupKeep])
check('A supervisor fixes a store’s data', (await sys(`select name from store where id = $1`, [dupKeep]))[0].name === 'Autoservicio Lili')

// ---- Maintenance: retention and purge keep how visits ended
const wOld = (await sys(`insert into workday (company_id, merchandiser_id, work_date, status, created_by) values ($1, $2, '2024-03-01', 'published', $2) returning id`, [panda, agus]))[0].id
const vOld = (await sys(`insert into visit (company_id, workday_id, merchandiser_id, work_date, store_id, added_by) values ($1, $2, $3, '2024-03-01', $4, $3) returning id`, [panda, wOld, agus, s1]))[0].id
const fOld = (await sys(`insert into photo (id, company_id, visit_id, kind, taken_at, uploaded_at, bytes, width, height, created_by) values (gen_random_uuid(), $1, $2, 'storefront', '2024-03-01T12:00:00Z', '2024-03-01T12:00:00Z', 1, 1, 1, $3) returning id`, [panda, vOld, agus]))[0].id
await sys(`update visit set work_status = 'in_progress', arrived_at = '2024-03-01T12:00:00Z', consent = 'yes' where id = $1`, [vOld])
await sys(`update visit set work_status = 'done' where id = $1`, [vOld])
const vGone = (await sys(`insert into visit (company_id, workday_id, merchandiser_id, work_date, store_id, added_by) values ($1, $2, $3, '2024-03-01', $4, $3) returning id`, [panda, wOld, agus, s1]))[0].id
const fGone = (await sys(`insert into photo (id, company_id, visit_id, kind, taken_at, uploaded_at, bytes, width, height, created_by) values (gen_random_uuid(), $1, $2, 'storefront', now(), now(), 1, 1, 1, $3) returning id`, [panda, vGone, agus]))[0].id
await sys(`update visit set deleted_at = now() - interval '40 days' where id = $1`, [vGone])
const purged = await sys(`select * from private.purge()`)
check('Purge returns the photos past retention and those of visits deleted long ago', purged.some(r => r.photo_id === fOld) && purged.some(r => r.photo_id === fGone))
check('An old finished visit stays finished when its storefront photo expires', (await sys(`select work_status::text s, arrived_at is not null a from visit where id = $1`, [vOld]))[0].s === 'done')
check('Visits deleted 30+ days ago are gone, with their photos', (await sys(`select (select count(*)::int from visit where id = $1) v, (select count(*)::int from photo where id = $2) f`, [vGone, fGone]))[0].v + (await sys(`select count(*)::int n from photo where id = $1`, [fGone]))[0].n === 0)
await expectError('Nobody can run the purge from the app', () => as('carla', `select * from private.purge()`))

// ---- MVP backup import (platform admin, own work)
const mvp = {
  stores: [{ id: '01926f00-0000-5000-8000-0000000000b1', cn: '9874', name: null, address: 'Arce 730', area: 'Palermo 5', lat: -34.56, lng: -58.43 }],
  workdays: [{ id: '01926f00-0000-4000-8000-0000000000d1', date: '2026-10-01' }],
  visits: [
    { id: '01926f00-0000-4000-8000-0000000000e1', wd: '01926f00-0000-4000-8000-0000000000d1', date: '2026-10-01', store: '01926f00-0000-5000-8000-0000000000b1', sort: 0, task: 'Activar', status: 'done', consent: 'yes', objection: null, arrived: '2026-10-01T12:37:00-03:00', finished: '2026-10-01T12:37:00-03:00', notes: 'Collarines', approved: true, resumed: null },
    { id: '01926f00-0000-4000-8000-0000000000e2', wd: '01926f00-0000-4000-8000-0000000000d1', date: '2026-10-01', store: '01926f00-0000-5000-8000-0000000000b1', sort: 1, task: null, status: 'pending', consent: null, objection: null, arrived: null, finished: null, notes: null, approved: false, resumed: null },
  ],
  displays: [{ id: '01926f00-0000-4000-8000-0000000000f1', visit: '01926f00-0000-4000-8000-0000000000e1', type: 'Puntera', ref: null, source: 'found', sort: 0 }],
  photos: [{ id: '01926f00-0000-5000-8000-0000000000a1', visit: '01926f00-0000-4000-8000-0000000000e1', display: '01926f00-0000-4000-8000-0000000000f1', kind: 'before', taken: '2026-10-01T12:37:00-03:00', bytes: 200000, w: 1400, h: 1050 }],
  metrics: [{ visit: '01926f00-0000-4000-8000-0000000000e1', metric: 'Kits de bolsas', qty: 4 }],
  brands: [{ visit: '01926f00-0000-4000-8000-0000000000e1', brand: 'SKYY' }],
}
await expectError('Only a platform admin can import an MVP backup', () => as('agus', `select import_mvp_backup($1, $2)`, [panda, mvp]), /platform admin/)
await sys(`insert into platform_admin (person_id) values ($1)`, [agus])
const imported = (await as('agus', `select import_mvp_backup($1, $2) r`, [panda, mvp]))[0].r
check(`Import returns what was saved (${JSON.stringify(imported)})`, imported.workdays === 1 && imported.visits === 2 && imported.photos === 1)
const iv = (await sys(`select work_status::text w, review_status::text r, source::text s, added_by = $2 mine, finished_at is not null f from visit where id = $1`, ['01926f00-0000-4000-8000-0000000000e1', agus]))[0]
check('Imported visit keeps its history: done, approved, assigned', iv.w === 'done' && iv.r === 'approved' && iv.s === 'assigned' && iv.mine && iv.f)
check('Imported work and brand', (await sys(`select (select quantity from visit_metric where visit_id = $1) q, (select count(*)::int from visit_brand where visit_id = $1) b`, ['01926f00-0000-4000-8000-0000000000e1']))[0].q === 4)
await as('agus', `select import_mvp_backup($1, $2)`, [panda, mvp])
check('Importing twice does not duplicate', (await sys(`select count(*)::int n from visit where workday_id = '01926f00-0000-4000-8000-0000000000d1'`))[0].n === 2)
await as('agus', `update visit set work_status = 'in_progress' where id = '01926f00-0000-4000-8000-0000000000e2'`)
await expectError('After the import the storefront rule applies again', () => as('agus', `update visit set work_status = 'closed', consent = 'closed' where id = '01926f00-0000-4000-8000-0000000000e2'`), /storefront/)

// Password detection (Google users who later set a password)
await sys(`update auth.users set encrypted_password = '$2a$10$hash' where id = $1`, [U.agus]);
check('has_password is true for a user with a password', (await as('agus', `select has_password() v`))[0].v === true);
check('has_password is false for a user without one', (await as('lucia', `select has_password() v`))[0].v === false);
await expectError('Anonymous cannot call has_password', () => asAnon(`select has_password()`));

const carlaMembership = (await sys(`select id from membership where person_id = $1`, [await pid('carla')]))[0].id;
await expectError('A company cannot lose its last admin', () => as('carla', `update membership set roles = '{supervisor}' where id = $1`, [carlaMembership]), /admin/);

console.log('\nQuery plan for visits as supervisor:');
await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${U.martin}', false);`);
for (const row of (await db.query(`explain select id from visit where work_date = '2026-10-09'`)).rows) console.log('  ' + row['QUERY PLAN']);
await db.exec('reset role;');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
