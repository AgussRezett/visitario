// Signs in with DNI + password. The DNI is resolved to the account email server-side,
// so the browser never learns whether a DNI exists: every failure returns the same 401.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let dni = ''
  let password = ''
  try {
    const body = await req.json()
    dni = String(body?.dni ?? '').replace(/\D/g, '')
    password = String(body?.password ?? '')
  } catch {
    return json({ error: 'invalid_credentials' }, 401)
  }
  if (!/^[0-9]{7,8}$/.test(dni) || password.length < 1 || password.length > 72) {
    return json({ error: 'invalid_credentials' }, 401)
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  let email: string | null = null
  const { data: priv } = await admin.from('person_private').select('person_id').eq('dni', dni).maybeSingle()
  if (priv) {
    const { data: person } = await admin.from('person').select('auth_user_id').eq('id', priv.person_id).maybeSingle()
    if (person?.auth_user_id) {
      const { data } = await admin.auth.admin.getUserById(person.auth_user_id)
      email = data.user?.email ?? null
    }
  }

  // Always attempt a sign-in, even for unknown DNIs, so timing does not reveal existence.
  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  const { data, error } = await client.auth.signInWithPassword({
    email: email ?? `unknown-${crypto.randomUUID()}@invalid.visitario`,
    password,
  })
  if (error || !data.session) return json({ error: 'invalid_credentials' }, 401)

  return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token })
})
