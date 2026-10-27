// Address search with LocationIQ, for signed-in people only (the key stays on the server).
//   POST { query: string, scope?: 'caba' | 'argentina', area?: string }
//   → { results: [{ label, address, area, lat, lng, exact }] }
// `exact` means the same street number was found, so the store can be saved as verified.
//
//   POST { storeId: string } → { status: 'verified' | 'approximate' | 'not_found' | 'kept' }
// Locates a store of the caller's company and saves it here, with the company's scope and the
// store's zone: whoever added it (an activador cannot edit stores) gets it verified. Only a
// store not verified yet changes; a verified or hand-pinned location is never touched.
// For the City (scope 'caba') only places inside it count: the old box around the City also
// covered Lanús and Avellaneda ("Yatay 461" landed in Valentín Alsina). Several questions are
// tried in order, from the most precise (with the barrio), stopping at the first exact answer.
// Without LOCATIONIQ_KEY it answers 503 and the app saves the address unverified.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { barrioOf, numberOf, rank, type Candidate } from './rank.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const key = Deno.env.get('LOCATIONIQ_KEY') ?? ''
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
// Ciudad Autónoma de Buenos Aires, as left,top,right,bottom (a hint; inCaba decides)
const CABA_VIEWBOX = '-58.5315,-34.5265,-58.3351,-34.7051'
const CITY = 'Ciudad Autónoma de Buenos Aires'
// LocationIQ allows about two requests a second
const PAUSE_MS = 520

interface LocationIqResult {
  lat: string
  lon: string
  display_name: string
  address?: Record<string, string | undefined>
}

const toCandidate = (r: LocationIqResult): Candidate => {
  const a = r.address ?? {}
  return {
    lat: Number(r.lat),
    lng: Number(r.lon),
    label: r.display_name,
    road: a.road ?? a.pedestrian ?? a.name ?? '',
    houseNumber: a.house_number ?? '',
    suburb: a.suburb ?? a.neighbourhood ?? a.city_district ?? a.quarter ?? null,
    state: a.state ?? null,
    county: a.county ?? a.state_district ?? null,
    city: a.city ?? a.town ?? null,
  }
}

async function ask(params: Record<string, string>): Promise<Candidate[] | null> {
  const url = new URL('https://us1.locationiq.com/v1/search')
  url.search = new URLSearchParams({ key, format: 'json', addressdetails: '1', normalizeaddress: '1', countrycodes: 'ar', limit: '6', 'accept-language': 'es', ...params }).toString()
  const res = await fetch(url)
  if (res.status === 404) return [] // LocationIQ answers 404 for "nothing found"
  if (!res.ok) return null
  return ((await res.json()) as LocationIqResult[]).map(toCandidate)
}

/** Every candidate for the address, asked from the most precise question to the loosest; null if the service failed. */
async function locate(query: string, caba: boolean, barrio: string | null): Promise<Candidate[] | null> {
  const attempts: Record<string, string>[] = caba
    ? [
        ...(barrio ? [{ q: `${query}, ${barrio}, ${CITY}` }] : []),
        { q: `${query}, ${CITY}` },
        { q: query, viewbox: CABA_VIEWBOX, bounded: '1' },
      ]
    : [{ q: query }]
  const found: Candidate[] = []
  let failed = 0
  for (const [i, params] of attempts.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, PAUSE_MS))
    const answer = await ask(params)
    if (answer === null) {
      failed++
      continue
    }
    found.push(...answer)
    const best = rank(found, query, { caba, barrio })[0]
    if (best?.exact && (!numberOf(query) || best.houseNumber === numberOf(query))) break
  }
  return failed === attempts.length ? null : found
}

async function verifyStore(storeId: string, authorization: string) {
  // Read as the caller: only a store of their own company is found.
  const asCaller = createClient(supabaseUrl, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: authorization } } })
  const { data: store } = await asCaller.from('store').select('id, company_id, address, area, location_status, removed_at').eq('id', storeId).maybeSingle()
  if (!store) return json({ error: 'not_found' }, 404)
  if (store.location_status === 'verified' || store.removed_at) return json({ status: 'kept' })

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: company } = await admin.from('company').select('geocoding_scope').eq('id', store.company_id).maybeSingle()
  const caba = company?.geocoding_scope !== 'argentina'
  const barrio = caba ? barrioOf(store.area) : null
  const found = await locate(store.address, caba, barrio)
  if (found === null) return json({ error: 'geocoder_failed' }, 502)
  const best = rank(found, store.address, { caba, barrio })[0]
  if (!best) return json({ status: 'not_found' })
  // An approximate place never replaces an approximate one already there (it may be a hand fix).
  if (!best.exact && store.location_status === 'approximate') return json({ status: 'kept' })

  const status = best.exact ? 'verified' : 'approximate'
  const { error } = await admin.from('store')
    .update({ lat: best.lat, lng: best.lng, location_status: status, ...(store.area ? {} : { area: best.suburb }) })
    .eq('id', store.id)
    .neq('location_status', 'verified')
  if (error) return json({ error: 'save_failed' }, 500)
  return json({ status })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authorization = req.headers.get('Authorization') ?? ''
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  const { data: auth } = await client.auth.getUser(authorization.replace(/^Bearer\s+/i, ''))
  if (!auth.user) return json({ error: 'unauthorized' }, 401)
  if (!key) return json({ error: 'not_configured' }, 503)

  const body = (await req.json().catch(() => null)) as { query?: unknown; scope?: unknown; area?: unknown; storeId?: unknown } | null
  if (typeof body?.storeId === 'string') return verifyStore(body.storeId, authorization)
  const query = typeof body?.query === 'string' ? body.query.trim().slice(0, 200) : ''
  if (query.length < 4) return json({ results: [] })
  const caba = body?.scope !== 'argentina'
  const barrio = caba ? barrioOf(typeof body?.area === 'string' ? body.area : null) : null
  const found = await locate(query, caba, barrio)
  if (found === null) return json({ error: 'geocoder_failed' }, 502)

  const results = rank(found, query, { caba, barrio }).slice(0, 5).map((c) => ({
    label: c.label,
    address: [c.road, c.houseNumber].filter(Boolean).join(' ') || c.label.split(',')[0],
    area: c.suburb,
    lat: c.lat,
    lng: c.lng,
    exact: c.exact,
  }))
  return json({ results })
})
