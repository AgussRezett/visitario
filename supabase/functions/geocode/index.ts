// Address search with LocationIQ, for signed-in people only (the key stays on the server).
//   POST { query: string, scope?: 'caba' | 'argentina' }
//   → { results: [{ label, address, area, lat, lng, exact }] }
// `exact` means the street number was found, so the store can be saved as verified.
// Without LOCATIONIQ_KEY it answers 503 and the app saves the address unverified.
import { createClient } from 'npm:@supabase/supabase-js@2'

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
// Ciudad Autónoma de Buenos Aires, as left,top,right,bottom
const CABA_VIEWBOX = '-58.5315,-34.5265,-58.3351,-34.7051'

interface LocationIqResult {
  lat: string
  lon: string
  display_name: string
  address?: Record<string, string | undefined>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authorization = req.headers.get('Authorization') ?? ''
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  const { data: auth } = await client.auth.getUser(authorization.replace(/^Bearer\s+/i, ''))
  if (!auth.user) return json({ error: 'unauthorized' }, 401)
  if (!key) return json({ error: 'not_configured' }, 503)

  const body = (await req.json().catch(() => null)) as { query?: unknown; scope?: unknown } | null
  const query = typeof body?.query === 'string' ? body.query.trim().slice(0, 200) : ''
  if (query.length < 4) return json({ results: [] })

  const url = new URL('https://us1.locationiq.com/v1/search')
  url.search = new URLSearchParams({
    key,
    q: query,
    format: 'json',
    addressdetails: '1',
    normalizeaddress: '1',
    countrycodes: 'ar',
    limit: '5',
    'accept-language': 'es',
  }).toString()
  if (body?.scope !== 'argentina') {
    url.searchParams.set('viewbox', CABA_VIEWBOX)
    url.searchParams.set('bounded', '1')
  }

  const res = await fetch(url)
  if (res.status === 404) return json({ results: [] }) // LocationIQ answers 404 for "nothing found"
  if (!res.ok) return json({ error: 'geocoder_failed' }, 502)
  const raw = (await res.json()) as LocationIqResult[]

  const results = raw.map((r) => {
    const a = r.address ?? {}
    const street = a.road ?? a.pedestrian ?? a.name ?? ''
    const number = a.house_number ?? ''
    return {
      label: r.display_name,
      address: [street, number].filter(Boolean).join(' ') || r.display_name.split(',')[0],
      area: a.suburb ?? a.neighbourhood ?? a.city_district ?? a.quarter ?? a.city ?? null,
      lat: Number(r.lat),
      lng: Number(r.lon),
      exact: Boolean(number),
    }
  })
  return json({ results })
})
