// Daily purge, called by pg_cron (supabase/cron/purge.sql) with the Vault's purge_secret,
// checked by public.purge_authorized (the secret never leaves the database).
//   POST, header x-purge-secret → { queued, deleted, failed, left }
// 1. public.run_purge(): photos past retention and what was deleted 30+ days ago; their
//    files go to the r2_trash queue.
// 2. Deletes those files from R2; a row leaves the queue only once R2 confirms
//    (a missing file counts as deleted). Failures stay for the next day.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { AwsClient } from 'npm:aws4fetch@1.0.20'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const accountId = Deno.env.get('R2_ACCOUNT_ID') ?? ''
const bucket = Deno.env.get('R2_BUCKET') ?? 'visitario-photos'
const r2 = new AwsClient({
  accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID') ?? '',
  secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '',
  service: 's3',
  region: 'auto',
})
const configured = /^[0-9a-f]{32}$/.test(accountId) && Boolean(Deno.env.get('R2_ACCESS_KEY_ID')) && Boolean(Deno.env.get('R2_SECRET_ACCESS_KEY'))
const BATCH = 500
const PARALLEL = 10

async function removeFile(key: string) {
  try {
    const res = await r2.fetch(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`, { method: 'DELETE' })
    return res.ok || res.status === 404
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } })
  const { data: allowed } = await admin.rpc('purge_authorized', { p_secret: req.headers.get('x-purge-secret') ?? '' })
  if (allowed !== true) return json({ error: 'unauthorized' }, 401)
  if (!configured) return json({ error: 'not_configured' }, 503)

  const { data: queued, error } = await admin.rpc('run_purge')
  if (error) return json({ error: 'purge_failed' }, 500)

  const { data: rows, error: listError } = await admin.from('r2_trash').select('key, attempts').order('created_at').limit(BATCH)
  if (listError) return json({ error: 'list_failed' }, 500)

  const gone: string[] = []
  const failed: { key: string; attempts: number }[] = []
  for (let i = 0; i < (rows ?? []).length; i += PARALLEL) {
    const chunk = (rows ?? []).slice(i, i + PARALLEL)
    const results = await Promise.all(chunk.map((r) => removeFile(r.key)))
    chunk.forEach((r, j) => (results[j] ? gone.push(r.key) : failed.push(r)))
  }
  for (let i = 0; i < gone.length; i += 100) await admin.from('r2_trash').delete().in('key', gone.slice(i, i + 100))
  for (const f of failed) await admin.from('r2_trash').update({ attempts: f.attempts + 1 }).eq('key', f.key)

  const { count } = await admin.from('r2_trash').select('key', { count: 'exact', head: true })
  return json({ queued, deleted: gone.length, failed: failed.length, left: count ?? 0 })
})
