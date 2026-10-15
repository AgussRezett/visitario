// Reads a capture of the routing list (a screenshot of the Excel, a WhatsApp message, a
// photo of a printed sheet) with Claude and returns its rows. Nothing is saved here: the
// rows go to the import review, like a spreadsheet.
//   POST multipart: `file` (JPEG/PNG/WebP, ≤ 6 MB) + `company` (uuid)
//   → { rows: [{ customer_number, name, address, area, merchandiser, task }], unreadable, model }
// Only supervisors and admins, of companies on a paid or pilot plan, up to a monthly cap.
// Without ANTHROPIC_API_KEY it answers 503 and the app says the feature is not on yet.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const model = Deno.env.get('AI_MODEL') ?? 'claude-haiku-5-5'
const monthlyCap = Number(Deno.env.get('AI_MONTHLY_CAPTURES') ?? '300')
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// USD per million tokens (input, output), to estimate what each capture costs.
const PRICES: Record<string, [number, number]> = {
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-sonnet-5-5': [2, 10],
  'claude-opus-5-5': [4, 20],
}
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const PLANS = new Set(['pilot', 'team', 'internal'])

const FIELD = { type: 'string' }
const SCHEMA = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: { customer_number: FIELD, name: FIELD, address: FIELD, area: FIELD, merchandiser: FIELD, task: FIELD },
        required: ['customer_number', 'name', 'address', 'area', 'merchandiser', 'task'],
        additionalProperties: false,
      },
    },
    unreadable: { type: 'integer' },
  },
  required: ['rows', 'unreadable'],
  additionalProperties: false,
}

const PROMPT = `La imagen es una lista de ruteo de una distribuidora de bebidas de Buenos Aires: los comercios que los activadores (repositores) tienen que visitar. Puede ser una captura de un Excel, un mensaje de WhatsApp o una foto de una hoja impresa.

Devolvé una fila por comercio, en el orden en que aparecen:
- customer_number: el número de cliente, solo dígitos y letras como figura. Vacío si no hay.
- name: el nombre o razón social del comercio, si figura. Vacío si no.
- address: la calle y la altura, tal como están escritas (sin agregar barrio ni ciudad). Corregí solo cortes de línea, no la ortografía.
- area: el barrio, localidad o zona, si figura.
- merchandiser: el nombre del activador o repositor asignado, si hay una columna o un título que lo indique (por ejemplo "REPOSITOR"). No uses el nombre del vendedor.
- task: una indicación para esa visita, si la hay (por ejemplo "armar puntera").

Reglas: no inventes datos ni completes lo que no se ve; dejá vacío lo que falte. Ignorá títulos, totales, fechas sueltas y filas sin dirección ni número de cliente. Si una fila no se puede leer, no la adivines: contala en "unreadable".`

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
  if (!apiKey) return json({ error: 'not_configured' }, 503)

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const company = String(form?.get('company') ?? '')
  if (!(file instanceof File) || !TYPES.has(file.type) || file.size > 6_000_000 || !/^[0-9a-f-]{36}$/.test(company)) {
    return json({ error: 'invalid' }, 400)
  }

  // Who may: a supervisor or admin of that company, on a plan that includes it, under the cap.
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: person } = await admin.from('person').select('id').eq('auth_user_id', auth.user.id).maybeSingle()
  const { data: member } = person
    ? await admin.from('membership').select('roles').eq('company_id', company).eq('person_id', person.id).eq('status', 'active').maybeSingle()
    : { data: null }
  const roles = (member?.roles ?? []) as string[]
  if (!roles.includes('supervisor') && !roles.includes('admin')) return json({ error: 'forbidden' }, 403)
  const { data: plan } = await admin.from('subscription').select('plan, status').eq('company_id', company).maybeSingle()
  if (!plan || plan.status !== 'active' || !PLANS.has(plan.plan)) return json({ error: 'plan' }, 402)
  const month = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 7) + '-01' // Argentina
  const { data: usage } = await admin.from('ai_usage').select('captures').eq('company_id', company).eq('month', month).maybeSingle()
  if ((usage?.captures ?? 0) >= monthlyCap) return json({ error: 'limit' }, 429)

  const image = toBase64(new Uint8Array(await file.arrayBuffer()))
  let res: Response
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(90_000),
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 16000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: file.type, data: image } },
            { type: 'text', text: PROMPT },
          ],
        }],
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      }),
    })
  } catch {
    return json({ error: 'ai_failed' }, 502)
  }
  if (!res.ok) {
    console.error('anthropic', res.status, (await res.text()).slice(0, 500))
    return json({ error: 'ai_failed' }, 502)
  }
  const out = (await res.json()) as { stop_reason?: string; content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } }
  const [inPrice, outPrice] = PRICES[model] ?? PRICES['claude-sonnet-5-5'] ?? [2, 10]
  const cost = ((out.usage?.input_tokens ?? 0) * inPrice + (out.usage?.output_tokens ?? 0) * outPrice) / 1000 // thousandths of a dollar
  await admin.rpc('record_ai_usage', { p_company: company, p_cost_thousandths: Math.ceil(cost) })

  const text = out.content?.find((c) => c.type === 'text')?.text ?? ''
  if (out.stop_reason !== 'end_turn' || !text) return json({ error: 'ai_incomplete' }, 502)
  try {
    const parsed = JSON.parse(text) as { rows?: unknown; unreadable?: unknown }
    return json({ rows: Array.isArray(parsed.rows) ? parsed.rows.slice(0, 300) : [], unreadable: Number(parsed.unreadable) || 0, model })
  } catch {
    return json({ error: 'ai_incomplete' }, 502)
  }
})
