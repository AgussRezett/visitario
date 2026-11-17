// Visits read by AI from what arrives: captures, photos and PDFs (a slide per store), with
// optional written indications ("todos son de Pablo Fo, menos Olaguer y Feliu que es de Mirko
// Ra; decime si falta algo"). Two steps, so the app can read several files at once:
//   1. POST multipart `file` (PDF ≤ 10 MB) + `company` → { pages: string[] }: the PDF's text,
//      page by page. No AI, no use spent. (Captures are transcribed by read-capture.)
//   2. POST JSON { company, pages: [{ label, text }], text, today } → { brief }: AI says which
//      stores the pages list and what the indications ask (seller per store, task, day, for
//      whom). One use. The app keeps only addresses written that way, in the pages' order
//      (src/domain/brief.ts). Nothing is saved here.
// (2.13 sent the PDF and the indications together, `text` in the form: still answered.)
// Merchandiser, supervisor or admin, within the AI limits.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { getDocumentProxy } from 'npm:unpdf@1.4.0'

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
const ROLES = new Set(['merchandiser', 'supervisor', 'admin'])
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MAX_PAGES = 40
const MAX_TEXT = 24_000

const prompt = (today: string, lists: string) => `Te pasan las visitas de un activador de góndolas: el texto de lo que le mandaron (PDF página por página, y capturas de listas ya transcriptas), y a veces indicaciones escritas. Devolvé los locales a visitar y lo que piden las indicaciones, en JSON.

Hoy es ${WEEKDAYS[new Date(`${today}T12:00:00Z`).getUTCDay()]} ${today}.

Listas de la empresa (usá solo estos ids y nombres):
${lists}

Respondé solo este JSON, sin texto antes ni después:
{"stops": [{"page": 2, "address": "", "customer_number": "", "area": "", "seller_id": null}], "task": "", "date": null, "merchandiser": null, "unknown": []}

- stops: cada local, en el orden en que aparecen. "page" es el número de la página donde está. "address" es la calle y altura copiadas tal cual, sin el número de cliente, barrio ni fechas. "customer_number" es el número de cliente: el de una columna de cliente/código, o el número que acompaña a la dirección en un título ("Cabildo 1130 #553" → "553"); si no hay, "". "area" es el barrio o la zona si está escrito; si no, "". Si un local aparece en varias páginas, ponelo una vez por página.
- No agregues locales que no estén en el texto. Ignorá portadas, títulos y fechas.
- seller_id: el vendedor de ese local según las indicaciones ("todos son de X, menos el de Y que es de Z") o según la columna de vendedor, con el id de la lista; null si no lo dicen.
- task: lo que piden hacer en cada local, corto y con sus palabras ("Avisar si falta algo y ordenar como en el PDF"); "" si no piden nada.
- date: el día de las visitas en formato AAAA-MM-DD ("mañana", "el martes"); null si no lo dicen.
- merchandiser: el nombre del activador si las indicaciones lo nombran; null si no.
- Si nombran un vendedor o una persona que no está en las listas, no lo reemplaces por otro: escribilo en "unknown".`

async function pdfPages(file: File): Promise<string[]> {
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()))
  const pages: string[] = []
  for (let i = 1; i <= Math.min(pdf.numPages, MAX_PAGES); i++) {
    const content = await (await pdf.getPage(i)).getTextContent()
    const lines = content.items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : '') : '')).join('')
    pages.push(lines.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim().slice(0, 1200))
  }
  return pages
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = await createClient(supabaseUrl, anonKey, { auth: { persistSession: false } }).auth.getUser(token)
  if (!auth.user) return json({ error: 'unauthorized' }, 401)

  const isForm = (req.headers.get('content-type') ?? '').startsWith('multipart/form-data')
  const form = isForm ? await req.formData().catch(() => null) : null
  const body = isForm ? null : ((await req.json().catch(() => null)) as Record<string, unknown> | null)
  const company = String(form?.get('company') ?? body?.company ?? '')
  if (!/^[0-9a-f-]{36}$/.test(company)) return json({ error: 'invalid' }, 400)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: person } = await admin.from('person').select('id').eq('auth_user_id', auth.user.id).maybeSingle()
  const { data: member } = person
    ? await admin.from('membership').select('roles').eq('company_id', company).eq('person_id', person.id).eq('status', 'active').maybeSingle()
    : { data: null }
  const roles = (member?.roles ?? []) as string[]
  if (!person || !roles.some((r) => ROLES.has(r))) return json({ error: 'forbidden' }, 403)

  // Step 1: a PDF's text, a page each.
  let labelled: { label: string; text: string }[]
  let pages: string[] = []
  if (form) {
    const file = form.get('file')
    if (!(file instanceof File) || file.type !== 'application/pdf' || file.size > 10_000_000) return json({ error: 'invalid' }, 400)
    try {
      pages = await pdfPages(file)
    } catch {
      return json({ error: 'unreadable' }, 422)
    }
    if (pages.join('').replace(/\s/g, '').length < 5) return json({ error: 'no_text' }, 422)
    if (!form.has('text')) return json({ pages })
    labelled = pages.map((text, i) => ({ label: `PDF pág. ${i + 1}`, text }))
  } else {
    labelled = (Array.isArray(body?.pages) ? body.pages : []).slice(0, 80).map((p) => {
      const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>
      return { label: String(o.label ?? '').slice(0, 40), text: String(o.text ?? '').slice(0, 4000) }
    })
    if (!labelled.some((p) => p.text.trim())) return json({ error: 'invalid' }, 400)
  }

  // Step 2: what the pages list and the indications ask.
  if (!cfAccount || !cfToken) return json({ error: 'not_configured' }, 503)
  const text = String(form?.get('text') ?? body?.text ?? '').trim().slice(0, 1500)
  const sent = String(form?.get('today') ?? body?.today ?? '')
  const today = /^\d{4}-\d{2}-\d{2}$/.test(sent) ? sent : new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)

  const { data: refused, error: checkError } = await admin.rpc('ai_allow', { p_company: company, p_person: person.id, p_platform_daily: platformDaily })
  if (checkError) return json({ error: 'ai_failed' }, 502)
  if (refused) {
    const [status, code] = REFUSED[refused] ?? [429, 'limit']
    return json({ error: code }, status)
  }

  const [sellers, people] = await Promise.all([
    admin.from('seller').select('id, name').eq('company_id', company).eq('active', true).limit(200),
    admin.from('membership').select('person:person_id (first_name, last_name)').eq('company_id', company).eq('status', 'active').contains('roles', ['merchandiser']).limit(200),
  ])
  const names = (people.data ?? []).map((m) => (m as { person?: { first_name?: string; last_name?: string } }).person).filter(Boolean).map((p) => `${p?.first_name} ${p?.last_name}`)
  const lists = [
    `Vendedores (id=nombre): ${(sellers.data ?? []).map((s) => `${s.id}=${s.name}`).join('; ') || 'ninguno'}`,
    `Activadores: ${names.join('; ') || 'ninguno'}`,
  ].join('\n')
  const user = `${labelled.map((p, i) => `--- Página ${i + 1} (${p.label}) ---\n${p.text || '(sin texto)'}`).join('\n').slice(0, MAX_TEXT)}\n\nIndicaciones:\n${text || '(ninguna)'}`

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/v1/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(90_000),
    headers: { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0, max_tokens: 6000, messages: [{ role: 'system', content: prompt(today, lists) }, { role: 'user', content: user }] }),
  }).catch(() => null)
  if (!res?.ok) {
    console.error('cloudflare', res?.status, (await res?.text())?.slice(0, 500))
    return json({ error: 'ai_failed' }, 502)
  }
  const out = (await res.json()) as { choices?: { message?: { content?: unknown } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } }
  // USD per million tokens (0.351 in, 0.555 out), in thousandths: what it would cost if paid.
  const cost = ((out.usage?.prompt_tokens ?? 0) * 0.351 + (out.usage?.completion_tokens ?? 0) * 0.555) / 1000
  await admin.rpc('record_ai_usage', { p_company: company, p_cost_thousandths: Math.ceil(cost), p_person: person.id, p_feature: 'capture' })

  const answer = out.choices?.[0]?.message?.content
  let brief: unknown = answer
  if (typeof answer === 'string') {
    const start = answer.indexOf('{')
    const end = answer.lastIndexOf('}')
    try {
      brief = start >= 0 && end > start ? JSON.parse(answer.slice(start, end + 1)) : null
    } catch {
      brief = null
    }
  }
  if (!brief || typeof brief !== 'object') return json({ error: 'ai_incomplete' }, 502)
  return json(form ? { pages, brief } : { brief })
})
