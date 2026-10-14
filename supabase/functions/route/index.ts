// The day's route by streets (LocationIQ Optimize), for signed-in people only.
//   POST { stops: [{ id, lat, lng }], origin?: { lat, lng }, firstId?, lastId?, mode: 'driving' | 'walking' }
//   → { ids: string[], km: number, minutes: number }
// The trip always starts at a fixed point: the origin, or the first store (the app sends one).
// Without LOCATIONIQ_KEY it answers 503 and the app keeps its straight-line order.
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

interface Point { lat: number; lng: number }
interface Stop extends Point { id: string }

// Argentina, roughly: keeps bad coordinates away from the provider.
const valid = (p: unknown): p is Point => {
  const q = p as Partial<Point> | null
  const lat = q?.lat ?? NaN
  const lng = q?.lng ?? NaN
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -55 && lat <= -21 && lng >= -74 && lng <= -53
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authorization = req.headers.get('Authorization') ?? ''
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  const { data: auth } = await client.auth.getUser(authorization.replace(/^Bearer\s+/i, ''))
  if (!auth.user) return json({ error: 'unauthorized' }, 401)
  if (!key) return json({ error: 'not_configured' }, 503)

  const body = (await req.json().catch(() => null)) as { stops?: unknown; origin?: unknown; firstId?: unknown; lastId?: unknown; mode?: unknown } | null
  const stops = Array.isArray(body?.stops) ? (body.stops as Stop[]) : []
  const origin = body?.origin === undefined || body?.origin === null ? undefined : body.origin
  const firstId = typeof body?.firstId === 'string' ? body.firstId : undefined
  const lastId = typeof body?.lastId === 'string' && body.lastId !== firstId ? body.lastId : undefined
  const mode = body?.mode === 'walking' ? 'walking' : body?.mode === 'driving' ? 'driving' : null
  if (
    !mode || stops.length < 2 || stops.length + (origin ? 1 : 0) > 25 ||
    !stops.every((s) => typeof s?.id === 'string' && s.id.length < 100 && valid(s)) ||
    new Set(stops.map((s) => s.id)).size !== stops.length ||
    (origin !== undefined && !valid(origin)) ||
    (firstId !== undefined && !stops.some((s) => s.id === firstId)) ||
    (lastId !== undefined && !stops.some((s) => s.id === lastId)) ||
    (!origin && !firstId)
  ) return json({ error: 'invalid' }, 400)

  // Fixed start first and fixed end last, as the provider expects with source/destination.
  const ordered = [...stops].sort((a, b) => (a.id === firstId ? -1 : b.id === firstId ? 1 : 0))
  if (lastId) ordered.sort((a, b) => (a.id === lastId ? 1 : b.id === lastId ? -1 : 0))
  const points: Point[] = origin ? [origin as Point, ...ordered] : ordered
  const url = new URL(`https://us1.locationiq.com/v1/optimize/${mode}/${points.map((p) => `${p.lng},${p.lat}`).join(';')}`)
  url.search = new URLSearchParams({ key, roundtrip: 'false', source: 'first', destination: lastId ? 'last' : 'any', overview: 'false', steps: 'false' }).toString()

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!res.ok) return json({ error: 'router_failed' }, 502)
    const result = (await res.json()) as { code?: string; waypoints?: { waypoint_index?: number }[]; trips?: { distance?: number; duration?: number }[] }
    const trip = result.trips?.[0]
    const waypoints = result.waypoints ?? []
    const distance = trip?.distance ?? NaN
    const duration = trip?.duration ?? NaN
    if (result.code !== 'Ok' || waypoints.length !== points.length) return json({ error: 'router_failed' }, 502)
    const shift = origin ? 1 : 0
    const placed = ordered.map((s, i) => ({ id: s.id, at: waypoints[i + shift]?.waypoint_index ?? -1 }))
    if (
      placed.some((p) => !Number.isInteger(p.at) || p.at < 0) || new Set(placed.map((p) => p.at)).size !== stops.length ||
      (origin && waypoints[0]?.waypoint_index !== 0) ||
      (firstId && placed.find((p) => p.id === firstId)?.at !== shift) ||
      (lastId && placed.find((p) => p.id === lastId)?.at !== points.length - 1) ||
      !Number.isFinite(distance) || !Number.isFinite(duration)
    ) return json({ error: 'router_failed' }, 502)
    return json({
      ids: placed.sort((a, b) => a.at - b.at).map((p) => p.id),
      km: Math.round(distance / 100) / 10,
      minutes: Math.round(duration / 60),
    })
  } catch {
    return json({ error: 'router_failed' }, 502)
  }
})
