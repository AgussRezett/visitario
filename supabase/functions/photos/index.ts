// Photos in Cloudflare R2, always through this function:
//   POST /photos          multipart: `file` (JPEG) + `meta` (JSON) → stores the row and the file
//   POST /photos/urls     { ids: string[] } → short-lived signed URLs to view them
// The row is inserted with the caller's token, so RLS and the database guards decide
// who may add a photo to which visit. Only after the file is in R2 is it marked uploaded.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { AwsClient } from 'npm:aws4fetch@1.0.20'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const MAX_BYTES = 1_500_000 // compressed on the phone to ~100–400 KB; this is a safety cap
const URL_TTL_SECONDS = 3600
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const accountId = Deno.env.get('R2_ACCOUNT_ID') ?? ''
const bucket = Deno.env.get('R2_BUCKET') ?? 'visitario-photos'
const r2 = new AwsClient({
  accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID') ?? '',
  secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '',
  service: 's3',
  region: 'auto',
})
// The Account ID is 32 hex characters (it is part of the S3 endpoint). Anything else, e.g. an
// API token pasted by mistake, would end up in URLs and error logs, so it is refused.
const configured = /^[0-9a-f]{32}$/.test(accountId) && Boolean(Deno.env.get('R2_ACCESS_KEY_ID')) && Boolean(Deno.env.get('R2_SECRET_ACCESS_KEY'))
const objectUrl = (key: string) => `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`
const objectKey = (companyId: string, visitId: string, photoId: string) => `c/${companyId}/v/${visitId}/${photoId}.jpg`

interface Meta {
  id: string
  visitId: string
  displayId: string | null
  kind: 'storefront' | 'before' | 'after'
  takenAt: string
  width: number
  height: number
  sortOrder?: number
}

function parseMeta(raw: unknown): Meta | null {
  if (typeof raw !== 'string') return null
  try {
    const m = JSON.parse(raw) as Meta
    const okKind = m.kind === 'storefront' || m.kind === 'before' || m.kind === 'after'
    const okDisplay = m.kind === 'storefront' ? m.displayId == null : typeof m.displayId === 'string' && UUID.test(m.displayId)
    if (!UUID.test(m.id) || !UUID.test(m.visitId) || !okKind || !okDisplay) return null
    if (!Number.isInteger(m.width) || !Number.isInteger(m.height) || m.width < 1 || m.height < 1 || m.width > 4000 || m.height > 4000) return null
    if (Number.isNaN(Date.parse(m.takenAt))) return null
    return m
  } catch {
    return null
  }
}

async function upload(req: Request, user: SupabaseClient, admin: SupabaseClient) {
  const form = await req.formData().catch(() => null)
  const meta = parseMeta(form?.get('meta'))
  const file = form?.get('file')
  if (!meta || !(file instanceof File)) return json({ error: 'invalid_request' }, 400)
  if (file.size < 1 || file.size > MAX_BYTES) return json({ error: 'file_too_large' }, 413)
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return json({ error: 'not_a_jpeg' }, 415)

  // The visit must be visible to the caller (RLS); its company decides the folder.
  const { data: visit } = await user.from('visit').select('company_id').eq('id', meta.visitId).maybeSingle()
  if (!visit) return json({ error: 'visit_not_found' }, 404)

  const { data: existing } = await user.from('photo').select('id, uploaded_at').eq('id', meta.id).maybeSingle()
  if (existing?.uploaded_at) return json({ id: meta.id, uploaded: true }) // retry of a finished upload
  if (!existing) {
    const { error } = await user.from('photo').insert({
      id: meta.id,
      company_id: visit.company_id,
      visit_id: meta.visitId,
      display_id: meta.displayId,
      kind: meta.kind,
      sort_order: meta.sortOrder ?? 0,
      taken_at: meta.takenAt,
      bytes: file.size,
      width: meta.width,
      height: meta.height,
      created_by: '00000000-0000-0000-0000-000000000000', // replaced by the database guard
    })
    if (error) return json({ error: 'not_allowed', detail: error.message }, 403)
  }

  // A row without its file would count as a photo, so any failure removes the row again.
  let stored = false
  try {
    const put = await r2.fetch(objectUrl(objectKey(visit.company_id, meta.visitId, meta.id)), {
      method: 'PUT',
      body: bytes,
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable' },
    })
    stored = put.ok
    if (!put.ok) console.error(`R2 PUT failed with status ${put.status}`)
  } catch (e) {
    console.error(`R2 PUT failed: ${e instanceof Error ? e.name : 'unknown error'}`) // no URL: it would expose the account
  }
  if (!stored) {
    if (!existing) await admin.from('photo').delete().eq('id', meta.id)
    return json({ error: 'storage_failed' }, 502)
  }
  await admin.from('photo').update({ uploaded_at: new Date().toISOString() }).eq('id', meta.id)
  return json({ id: meta.id, uploaded: true })
}

async function signedUrls(req: Request, user: SupabaseClient) {
  const body = (await req.json().catch(() => null)) as { ids?: unknown } | null
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === 'string' && UUID.test(x)).slice(0, 100) : []
  if (!ids.length) return json({ urls: {} })
  // Only photos the caller can see (RLS) and that finished uploading.
  const { data } = await user.from('photo').select('id, company_id, visit_id').in('id', ids).not('uploaded_at', 'is', null)
  const urls: Record<string, string> = {}
  for (const p of data ?? []) {
    const url = new URL(objectUrl(objectKey(p.company_id, p.visit_id, p.id)))
    url.searchParams.set('X-Amz-Expires', String(URL_TTL_SECONDS))
    const signed = await r2.sign(url.toString(), { method: 'GET', aws: { signQuery: true } })
    urls[p.id] = signed.url
  }
  return json({ urls })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!configured) {
    console.error('R2 is not configured: check R2_ACCOUNT_ID (32 hex characters), R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY')
    return json({ error: 'not_configured' }, 503)
  }

  const authorization = req.headers.get('Authorization') ?? ''
  const user = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const { data: auth } = await user.auth.getUser(authorization.replace(/^Bearer\s+/i, ''))
  if (!auth.user) return json({ error: 'unauthorized' }, 401)
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const path = new URL(req.url).pathname
  if (path.endsWith('/urls')) return signedUrls(req, user)
  return upload(req, user, admin)
})
