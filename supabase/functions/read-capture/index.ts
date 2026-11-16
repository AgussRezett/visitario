// Transcribes a capture of the routing list (a screenshot of the Excel, a WhatsApp message,
// an app's card, a photo of a printed sheet) with AI: its title, column titles and cells, as
// they are. The app decides what each column holds. Nothing is saved here: the rows go to
// the import review, like a spreadsheet.
//   POST multipart: `file` (JPEG/PNG/WebP, ≤ 6 MB) + `company` (uuid)
//   → { title, headers, rows: string[][], unreadable, model }
// Merchandisers (into their day), supervisors and admins, of companies on a paid or pilot
// plan, up to a monthly cap per company.
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

const monthlyCap = Number(Deno.env.get('AI_MONTHLY_CAPTURES') ?? '1000')
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const PLANS = new Set(['pilot', 'team', 'internal'])
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
  const file = form?.get('file')
  const company = String(form?.get('company') ?? '')
  if (!(file instanceof File) || !TYPES.has(file.type) || file.size > 6_000_000 || !/^[0-9a-f-]{36}$/.test(company)) {
    return json({ error: 'invalid' }, 400)
  }

  // Who may: anyone who plans days in that company, on a plan that includes it, under the cap.
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: person } = await admin.from('person').select('id').eq('auth_user_id', auth.user.id).maybeSingle()
  const { data: member } = person
    ? await admin.from('membership').select('roles').eq('company_id', company).eq('person_id', person.id).eq('status', 'active').maybeSingle()
    : { data: null }
  const roles = (member?.roles ?? []) as string[]
  if (!roles.some((r) => ROLES.has(r))) return json({ error: 'forbidden' }, 403)
  const { data: plan } = await admin.from('subscription').select('plan, status').eq('company_id', company).maybeSingle()
  if (!plan || plan.status !== 'active' || !PLANS.has(plan.plan)) return json({ error: 'plan' }, 402)
  const month = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 7) + '-01' // Argentina
  const { data: usage } = await admin.from('ai_usage').select('captures').eq('company_id', company).eq('month', month).maybeSingle()
  if ((usage?.captures ?? 0) >= monthlyCap) return json({ error: 'limit' }, 429)

  try {
    const reading = await readImage(toBase64(new Uint8Array(await file.arrayBuffer())), file.type)
    await admin.rpc('record_ai_usage', { p_company: company, p_cost_thousandths: Math.ceil(reading.cost) })
    if (!reading.transcript) return json({ error: 'ai_incomplete' }, 502)
    return json({ ...reading.transcript, model: reading.model })
  } catch (e) {
    return json({ error: e instanceof ProviderError ? e.message : 'ai_failed' }, 502)
  }
})
