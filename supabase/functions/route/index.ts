// The day's route by streets, for signed-in people only.
//   POST { stops: [{ id, lat, lng }], origin?: { lat, lng }, firstId?, lastId?, mode: 'driving' | 'walking' }
//   → { ids: string[], km: number, minutes: number, line: [lng, lat][] } (line: the path by streets, for the map)
// The trip always starts at a fixed point: the origin, or the first store (the app sends one).
// How: LocationIQ gives the street distance and time between every pair of points (Matrix);
// the order is solved here, exact up to 15 stores (./tsp.ts, the same file as src/domain/tsp.ts):
// on foot the shortest walk, by car the quickest drive (one-way streets count). Then
// LocationIQ draws that order by streets (Directions).
// Without LOCATIONIQ_KEY it answers 503 and the app keeps its straight-line order.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { shortestPath } from './tsp.ts'

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

  // The points: the origin first when there is one, then the stores.
  const points: Point[] = origin ? [origin as Point, ...stops] : [...stops]
  const shift = origin ? 1 : 0
  const firstAt = firstId ? stops.findIndex((s) => s.id === firstId) + shift : -1
  const lastAt = lastId ? stops.findIndex((s) => s.id === lastId) + shift : undefined
  const coords = (list: Point[]) => list.map((p) => `${p.lng},${p.lat}`).join(';')

  try {
    const matrix = await ask(`matrix/${mode}/${coords(points)}`, { annotations: 'distance,duration' }) as { code?: string; distances?: (number | null)[][]; durations?: (number | null)[][] }
    if (matrix?.code !== 'Ok') return json({ error: 'router_failed' }, 502)
    // On foot, the shortest walk; by car, the quickest drive. No street route: straight line, longer.
    const table = mode === 'walking' ? matrix.distances : matrix.durations
    const fallback = (i: number, j: number) => crowKm(points[i] as Point, points[j] as Point) * (mode === 'walking' ? 1400 : 180)
    const cost = (i: number, j: number) => {
      if (origin && firstAt > 0 && i === 0 && j !== firstAt) return 1e9 // the first store comes first
      const value = table?.[i]?.[j]
      return typeof value === 'number' && Number.isFinite(value) ? value : fallback(i, j)
    }
    const { order } = shortestPath({ n: points.length, cost, start: origin ? 0 : firstAt, end: lastAt })
    const ids = order.filter((i) => i >= shift).map((i) => (stops[i - shift] as Stop).id)
    if (ids.length !== stops.length) return json({ error: 'router_failed' }, 502)

    const trip = await ask(`directions/${mode}/${coords(order.map((i) => points[i] as Point))}`, { overview: 'full', geometries: 'geojson', steps: 'false' }) as
      { code?: string; routes?: { distance?: number; duration?: number; geometry?: { coordinates?: unknown } }[] }
    const route = trip?.code === 'Ok' ? trip.routes?.[0] : undefined
    const distance = route?.distance ?? NaN
    const duration = route?.duration ?? NaN
    if (!Number.isFinite(distance) || !Number.isFinite(duration)) return json({ error: 'router_failed' }, 502)
    // The path, rounded to ~1 m and at most 4000 points: enough to draw it, light to send.
    const raw = route?.geometry?.coordinates
    const path: unknown[] = Array.isArray(raw) ? raw : []
    const step = Math.max(1, Math.ceil(path.length / 4000))
    const line = path
      .filter((_, i) => i % step === 0 || i === path.length - 1)
      .flatMap((c) => (Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]) ? [[Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5]] : []))
    return json({ ids, km: Math.round(distance / 100) / 10, minutes: Math.round(duration / 60), line })
  } catch {
    return json({ error: 'router_failed' }, 502)
  }
})

/** One LocationIQ call; the free plan allows 2 a second, so a refusal waits and tries once more. */
async function ask(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`https://us1.locationiq.com/v1/${path}`)
  url.search = new URLSearchParams({ key, ...params }).toString()
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 700))
      continue
    }
    return res.ok ? await res.json() : null
  }
  return null
}

/** Straight-line distance in km. */
function crowKm(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const arc = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 12742 * Math.asin(Math.min(1, Math.sqrt(arc)))
}
