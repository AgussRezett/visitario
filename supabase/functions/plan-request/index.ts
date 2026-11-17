// Armar recorrido, asked for in words: "12 locales de Mirko en Palermo que no se activaron
// este mes y que reciban bien". AI turns it into a goal and filters, using only the
// company's own lists; the app checks the answer again (src/domain/plan-request.ts) and the
// supervisor sees it before planning. Choosing and ordering the stores is never the AI's.
//   POST { company, text, today } → { plan }
// Supervisors and admins, within the AI limits (one use, like a capture).
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const cfAccount = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') ?? ''
const cfToken = Deno.env.get('CLOUDFLARE_AI_TOKEN') ?? ''
const model = '@cf/mistralai/mistral-small-3.1-24b-instruct'
const platformDaily = Number(Deno.env.get('AI_PLATFORM_DAILY') ?? '170') || null
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const REFUSED: Record<string, [number, string]> = {
  plan: [402, 'plan'], month: [429, 'limit'], person_day: [429, 'limit_person'], platform_day: [429, 'limit_platform'],
}
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const prompt = (today: string, lists: string) => `Ayudás a un supervisor de activadores a armar un recorrido de comercios. Convertí su pedido en filtros, en JSON.

Hoy es ${WEEKDAYS[new Date(`${today}T12:00:00Z`).getUTCDay()]} ${today}.

Usá solo lo que está en estas listas, con sus ids o nombres exactos:
${lists}

Objetivos (goal):
- "most": la mayor cantidad de locales en el menor trayecto.
- "overdue": los más atrasados, sin visitar hace mucho o nunca activados.
- "requests": pedidos de los vendedores y locales con novedades.
- "rapport": los que mejor reciben al activador.

Respondé solo este JSON, sin texto antes ni después:
{"goal": null, "seller_ids": [], "channel_ids": [], "areas": [], "zone_id": null, "min_rapport": null, "stale_days": null, "count": null, "mode": null, "merchandiser": null, "date": null, "unknown": []}

- min_rapport: "welcoming" (buena onda, reciben bien), "restricted" o "indifferent"; null si no lo pide.
- stale_days: días sin activar que pide ("este mes" o "hace un mes" son 30); null si no lo pide.
- count: cuántos locales; mode: "walking" (a pie) o "driving" (en auto); merchandiser: el nombre del activador tal como lo dijo; date: el día en formato AAAA-MM-DD ("mañana", "el martes").
- Dejá null o vacío todo lo que el pedido no dice. No agregues filtros por tu cuenta.
- Si nombra algo que no está en las listas (un vendedor, una zona, un barrio que no existen), no lo reemplaces por otro: escribilo en "unknown".`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = await createClient(supabaseUrl, anonKey, { auth: { persistSession: false } }).auth.getUser(token)
  if (!auth.user) return json({ error: 'unauthorized' }, 401)
  if (!cfAccount || !cfToken) return json({ error: 'not_configured' }, 503)

  const body = (await req.json().catch(() => null)) as { company?: unknown; text?: unknown; today?: unknown } | null
  const company = String(body?.company ?? '')
  const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 500) : ''
  const today = typeof body?.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)
  if (!/^[0-9a-f-]{36}$/.test(company) || text.length < 3) return json({ error: 'invalid' }, 400)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: person } = await admin.from('person').select('id').eq('auth_user_id', auth.user.id).maybeSingle()
  const { data: member } = person
    ? await admin.from('membership').select('roles').eq('company_id', company).eq('person_id', person.id).eq('status', 'active').maybeSingle()
    : { data: null }
  const roles = (member?.roles ?? []) as string[]
  if (!person || (!roles.includes('supervisor') && !roles.includes('admin'))) return json({ error: 'forbidden' }, 403)
  const { data: refused, error: checkError } = await admin.rpc('ai_allow', { p_company: company, p_person: person.id, p_platform_daily: platformDaily })
  if (checkError) return json({ error: 'ai_failed' }, 502)
  if (refused) {
    const [status, code] = REFUSED[refused] ?? [429, 'limit']
    return json({ error: code }, status)
  }

  // The company's own lists: the only names the AI may use.
  const [sellers, channels, zones, stores, people] = await Promise.all([
    admin.from('seller').select('id, name').eq('company_id', company).eq('active', true).limit(200),
    admin.from('channel').select('id, name').eq('company_id', company).eq('active', true).limit(50),
    admin.from('route_zone').select('id, name').eq('company_id', company).is('deleted_at', null).limit(100),
    admin.from('store').select('area').eq('company_id', company).is('deleted_at', null).not('area', 'is', null).limit(5000),
    admin.from('membership').select('person:person_id (first_name, last_name)').eq('company_id', company).eq('status', 'active').contains('roles', ['merchandiser']).limit(200),
  ])
  const areas = [...new Set((stores.data ?? []).map((s) => String(s.area)))].sort().slice(0, 200)
  const names = (people.data ?? []).map((m) => (m as { person?: { first_name?: string; last_name?: string } }).person).filter(Boolean).map((p) => `${p?.first_name} ${p?.last_name}`)
  const lists = [
    `Vendedores (id=nombre): ${(sellers.data ?? []).map((s) => `${s.id}=${s.name}`).join('; ') || 'ninguno'}`,
    `Canales (id=nombre): ${(channels.data ?? []).map((c) => `${c.id}=${c.name}`).join('; ') || 'ninguno'}`,
    `Zonas dibujadas (id=nombre): ${(zones.data ?? []).map((z) => `${z.id}=${z.name}`).join('; ') || 'ninguna'}`,
    `Barrios (usá el nombre): ${areas.join('; ') || 'ninguno'}`,
    `Activadores: ${names.join('; ') || 'ninguno'}`,
  ].join('\n')

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/v1/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(45_000),
    headers: { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0, max_tokens: 600, messages: [{ role: 'system', content: prompt(today, lists) }, { role: 'user', content: text }] }),
  }).catch(() => null)
  if (!res?.ok) {
    console.error('cloudflare', res?.status, (await res?.text())?.slice(0, 500))
    return json({ error: 'ai_failed' }, 502)
  }
  const out = (await res.json()) as { choices?: { message?: { content?: unknown } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } }
  // USD per million tokens (0.351 in, 0.555 out), in thousandths: what it would cost if paid.
  const cost = ((out.usage?.prompt_tokens ?? 0) * 0.351 + (out.usage?.completion_tokens ?? 0) * 0.555) / 1000
  await admin.rpc('record_ai_usage', { p_company: company, p_cost_thousandths: Math.ceil(cost), p_person: person.id, p_feature: 'plan' })

  const answer = out.choices?.[0]?.message?.content
  let plan: unknown = answer
  if (typeof answer === 'string') {
    const start = answer.indexOf('{')
    const end = answer.lastIndexOf('}')
    try {
      plan = start >= 0 && end > start ? JSON.parse(answer.slice(start, end + 1)) : null
    } catch {
      plan = null
    }
  }
  if (!plan || typeof plan !== 'object') return json({ error: 'ai_incomplete' }, 502)
  return json({ plan })
})
