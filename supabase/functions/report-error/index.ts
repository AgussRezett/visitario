// A problem reported from the app: a screen that broke, or something a person wants to tell.
//   POST { kind: 'crash' | 'manual', message, detail?, comment?, url?, appVersion?, companyId? }
//   → { id, emailed }
// With or without a session (a crash at sign-in has none). The report is stored (error_report)
// and emailed to ERROR_REPORT_TO through Gmail (GMAIL_USER, GMAIL_APP_PASSWORD, as the
// invitations). record_error_report decides what is emailed: repeats and floods are only stored.
import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'
import { reportMessage } from './mail.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const reportTo = Deno.env.get('ERROR_REPORT_TO') ?? ''
const gmailUser = Deno.env.get('GMAIL_USER') ?? ''
const gmailPassword = (Deno.env.get('GMAIL_APP_PASSWORD') ?? '').replace(/\s+/g, '')
const mailer = gmailUser && gmailPassword && reportTo
  ? nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: gmailUser, pass: gmailPassword },
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
    })
  : null

const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const UUID = /^[0-9a-f-]{36}$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const kind = body?.kind === 'manual' ? 'manual' : 'crash'
  const message = text(body?.message, 500) ?? (kind === 'manual' ? 'Reporte sin título' : null)
  const comment = text(body?.comment, 1000)
  if (!message || (kind === 'manual' && !comment)) return json({ error: 'invalid' }, 400)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  // Who: the session's person, when there is one.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: auth } = token && token !== anonKey
    ? await createClient(supabaseUrl, anonKey, { auth: { persistSession: false } }).auth.getUser(token)
    : { data: { user: null } }
  const { data: person } = auth.user
    ? await admin.from('person').select('id, first_name, last_name').eq('auth_user_id', auth.user.id).maybeSingle()
    : { data: null }
  const companyId = typeof body?.companyId === 'string' && UUID.test(body.companyId) ? body.companyId : null

  const report = {
    kind, message, comment,
    detail: text(body?.detail, 4000),
    url: text(body?.url, 500),
    appVersion: text(body?.appVersion, 40),
    userAgent: text(req.headers.get('User-Agent'), 300),
  } as const
  const { data: rows, error } = await admin.rpc('record_error_report', {
    p_person: person?.id ?? null, p_company: companyId, p_kind: kind, p_message: message, p_detail: report.detail,
    p_comment: comment, p_url: report.url, p_app_version: report.appVersion, p_user_agent: report.userAgent,
  })
  if (error) return json({ error: 'failed' }, 500)
  const row = (rows as { id: string; email: boolean }[] | null)?.[0]
  if (!row) return json({ error: 'too_many' }, 429)

  let emailed = false
  if (row.email && mailer) {
    const { data: company } = await admin.from('error_report').select('company:company_id (name)').eq('id', row.id).maybeSingle()
    const who = person ? `${person.first_name} ${person.last_name}${auth.user?.email ? ` <${auth.user.email}>` : ''}` : 'Sin sesión'
    const companyName = (company?.company as { name?: string } | null)?.name ?? null
    try {
      await mailer.sendMail({ from: { name: 'Visitario', address: gmailUser }, to: reportTo, ...reportMessage({ ...report, who, company: companyName }, row.id) })
      emailed = true
    } catch (e) {
      console.error('report email', (e as Error).message?.slice(0, 200))
      await admin.from('error_report').update({ emailed: false }).eq('id', row.id)
    }
  }
  return json({ id: row.id, emailed })
})
