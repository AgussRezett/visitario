// Invitations by email.
//   POST { action: 'create', companyId, dni, email, roles, teamId?, startsOn?, origin } (an admin)
//   POST { action: 'resend', invitationId, origin }                                    (an admin)
//     → { id, link, sent, error? }: the link goes back to the admin too, to share it by WhatsApp
//       if the email could not go out.
//   POST { action: 'signup', token, password }                                          (anyone with the link)
//     → { email }: creates the invited email's account, already confirmed (the link proves it).
//   POST { action: 'accepted' }                                                         (who just accepted)
//     → { sent }: emails the admin who invited them (or the company's admins) that they joined, once.
// The token is random, travels only in the link and the email; the database keeps its SHA-256.
// Email through Gmail with nodemailer: GMAIL_USER (visitarioadmin@gmail.com) and GMAIL_APP_PASSWORD
// (an app password of that account, not its normal password). Port 465: Supabase blocks 25 and 587.
// Without them the invitation is still created and the admin is told the email did not go out.
import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.16'
import { acceptedMessage, inviteMessage, type Accepted } from './mail.ts'

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
const gmailUser = Deno.env.get('GMAIL_USER') ?? ''
// Google shows app passwords in groups of four ("abcd efgh ijkl mnop"): spaces are not part of it.
const gmailPassword = (Deno.env.get('GMAIL_APP_PASSWORD') ?? '').replace(/\s+/g, '')
// Gmail sends as the account itself; only the name shown can change.
const fromName = Deno.env.get('INVITE_FROM_NAME') ?? 'Visitario'
const mailer = gmailUser && gmailPassword
  ? nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: gmailUser, pass: gmailPassword },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    })
  : null
const appUrl = (Deno.env.get('APP_URL') ?? 'https://visitario.vercel.app').replace(/\/$/, '')

interface Mail { id: string; email: string; roles: string[]; expires_at: string; company: string; inviter: string }

/** Where the link points: the app the admin is using, if it is ours. */
function linkBase(origin: unknown) {
  const o = typeof origin === 'string' ? origin.replace(/\/$/, '') : ''
  if (o === appUrl || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(o) || /^http:\/\/localhost:\d{2,5}$/.test(o)) return o
  return appUrl
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Sends the email; returns null when it went out, or why it did not. */
async function send(to: string, mail: { subject: string; text: string; html: string }): Promise<string | null> {
  if (!mailer) return 'not_configured'
  const { subject, text, html } = mail
  try {
    await mailer.sendMail({ from: { name: fromName, address: gmailUser }, to, subject, text, html })
    return null
  } catch (e) {
    const err = e as { code?: string; responseCode?: number; message?: string }
    // EAUTH: Gmail refused the user or the app password. Other codes: network or limits.
    if (err.code === 'EAUTH') return 'auth'
    if (err.responseCode) return `rejected: ${err.responseCode} ${err.message ?? ''}`.slice(0, 200)
    return 'unreachable'
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const action = body?.action

  // ---- The invited person creates their account from the link
  if (action === 'signup') {
    const token = typeof body?.token === 'string' ? body.token : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (token.length < 32 || password.length < 8 || password.length > 72) return json({ error: 'invalid' }, 400)
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const { data: preview } = await admin.rpc('invitation_preview', { p_token: token })
    const p = preview as { state?: string; email?: string } | null
    if (p?.state !== 'pending' || !p.email) return json({ error: p?.state ?? 'invalid' }, 409)
    const { error } = await admin.auth.admin.createUser({ email: p.email, password, email_confirm: true })
    if (error) return json({ error: /already|exists|registered/i.test(error.message) ? 'email_taken' : 'signup_failed' }, 409)
    return json({ email: p.email })
  }

  // ---- An admin invites or resends
  const authorization = req.headers.get('Authorization') ?? ''
  const user = createClient(supabaseUrl, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: authorization } } })
  const { data: auth } = await user.auth.getUser(authorization.replace(/^Bearer\s+/i, ''))
  if (!auth.user) return json({ error: 'unauthorized' }, 401)

  // ---- The invited person just accepted: tell the admin who invited them (once).
  if (action === 'accepted') {
    if (!mailer) return json({ sent: 0, error: 'not_configured' })
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const { data, error } = await admin.rpc('take_acceptance_notices', { p_auth_user: auth.user.id })
    if (error) return json({ error: 'failed' }, 500)
    let sent = 0
    for (const n of (data ?? []) as (Accepted & { recipients: string[] })[]) {
      const message = acceptedMessage(n, appUrl)
      for (const to of n.recipients) if ((await send(to, message)) === null) sent++
    }
    return json({ sent })
  }

  const token = newToken()
  let mail: Mail | null = null
  if (action === 'create') {
    const dni = String(body?.dni ?? '').replace(/\D/g, '')
    const email = String(body?.email ?? '').trim().toLowerCase()
    const roles = Array.isArray(body?.roles) ? body.roles.filter((r): r is string => typeof r === 'string') : []
    if (!/^[0-9]{7,8}$/.test(dni) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !roles.length) return json({ error: 'invalid' }, 400)
    const { data, error } = await user.rpc('create_invitation', {
      p_company: body?.companyId, p_dni: dni, p_email: email, p_roles: roles,
      p_team: body?.teamId ?? null, p_starts_on: body?.startsOn ?? null, p_token: token,
    })
    if (error) return json({ error: error.message }, error.code === '42501' ? 403 : 409)
    mail = data as Mail
  } else if (action === 'resend') {
    const { data, error } = await user.rpc('resend_invitation', { p_invitation: body?.invitationId, p_token: token })
    if (error) return json({ error: error.message }, error.code === '42501' ? 403 : 409)
    mail = data as Mail
  } else {
    return json({ error: 'invalid' }, 400)
  }

  const link = `${linkBase(body?.origin)}/invitacion/${token}`
  const failure = await send(mail.email, inviteMessage(mail, link, appUrl))
  await user.rpc('mark_invitation_sent', { p_invitation: mail.id, p_error: failure })
  return json({ id: mail.id, link, sent: failure === null, ...(failure ? { error: failure.split(':')[0] } : {}) })
})
