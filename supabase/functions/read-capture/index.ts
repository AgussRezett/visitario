// Transcribes a capture of the routing list (a screenshot of the Excel, a WhatsApp message,
// an app's card, a photo of a printed sheet) with AI: its title, column titles and cells, as
// they are. The app decides what each column holds. Nothing is saved here: the rows go to
// the import review, like a spreadsheet.
//   POST multipart: `file` (JPEG/PNG/WebP, ≤ 6 MB; up to 4 slices of one long capture) + `company` (uuid)
//   → { title, headers, rows: string[][], unreadable, model }
// Merchandisers (into their day), supervisors and admins, within the limits (ai_allow): the
// company's month (Visitario sets it; none on the free plan), the person's day (the company
// admin sets it) and the platform's day (AI_PLATFORM_DAILY: the provider's free allowance).
// Every capture is logged with who read it.
// Reads with Cloudflare Workers AI (CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_AI_TOKEN), or with
// Claude (ANTHROPIC_API_KEY); with neither it answers 503 and the app says it is not on yet.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { ProviderError, provider, readImage } from './providers.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// Cloudflare's free allowance is 10,000 neurons a day, about 180 captures: stay under it.
const platformDaily = Number(Deno.env.get('AI_PLATFORM_DAILY') ?? (provider === 'cloudflare' ? '170' : '0')) || null
// Why a capture is not allowed, as the app tells it apart.
const REFUSED: Record<string, [number, string]> = {
  plan: [402, 'plan'], month: [429, 'limit'], person_day: [429, 'limit_person'], platform_day: [429, 'limit_platform'],
}
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const ROLES = new Set(['merchandiser', 'supervisor', 'admin'])

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = await createClient(supabaseUrl, anonKey, { auth: { persistSession: false } }).auth.getUser(token)
  if (!auth.user) return json({ error: 'unauthorized' }, 401)
  if (!provider) return json({ error: 'not_configured' }, 503)

  const form = await req.formData().catch(() => null)
  // One capture; a long one (a scrolled list) comes in up to 4 overlapping slices, top to bottom.
  const files = (form?.getAll('file') ?? []).slice(0, 4)
  const company = String(form?.get('company') ?? '')
  if (!files.length || files.some((f) => !(f instanceof File) || !TYPES.has(f.type) || f.size > 6_000_000) || !/^[0-9a-f-]{36}$/.test(company)) {
    return json({ error: 'invalid' }, 400)
  }

  // Who may: anyone who plans days in that company, within its limits.
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: person } = await admin.from('person').select('id').eq('auth_user_id', auth.user.id).maybeSingle()
  const { data: member } = person
    ? await admin.from('membership').select('roles').eq('company_id', company).eq('person_id', person.id).eq('status', 'active').maybeSingle()
    : { data: null }
  const roles = (member?.roles ?? []) as string[]
  if (!person || !roles.some((r) => ROLES.has(r))) return json({ error: 'forbidden' }, 403)
  const { data: refused, error: checkError } = await admin.rpc('ai_allow', { p_company: company, p_person: person.id, p_platform_daily: platformDaily })
  if (checkError) return json({ error: 'ai_failed' }, 502)
  const [status, code] = refused ? REFUSED[refused] ?? [429, 'limit'] : [0, '']
  if (status) return json({ error: code }, status)

  try {
    const images = await Promise.all((files as File[]).map(async (f) => ({ data: toBase64(new Uint8Array(await f.arrayBuffer())), type: f.type })))
    const reading = await readImage(images)
    await admin.rpc('record_ai_usage', { p_company: company, p_cost_thousandths: Math.ceil(reading.cost), p_person: person.id })
    if (!reading.transcript) return json({ error: 'ai_incomplete' }, 502)
    return json({ ...reading.transcript, model: reading.model })
  } catch (e) {
    return json({ error: e instanceof ProviderError ? e.message : 'ai_failed' }, 502)
  }
})
