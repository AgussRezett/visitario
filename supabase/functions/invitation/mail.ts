// The emails of invitations, in Visitario's look: logo, ground, white card, forest button.
// Tables and inline styles only: that is what mail apps render. The logo is a PNG served by
// the app (public/email/logo.png), since most mail apps do not show SVG.

const C = { forest: '#173b30', lime: '#b8d941', ground: '#f6f7f2', ink: '#173b30', soft: '#3f5a50', subtle: '#5d7268', line: '#e3e7dc', card: '#ffffff' }
const FONT = "'Plus Jakarta Sans',Arial,Helvetica,sans-serif"

export const ROLE: Record<string, string> = { merchandiser: 'activador', seller: 'vendedor', supervisor: 'supervisor', admin: 'admin de la empresa' }
export const rolesText = (roles: string[]) => roles.map((r) => ROLE[r] ?? r).join(' y ')

export const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)

export interface Layout {
  appUrl: string
  /** What mail apps show next to the subject. */
  preheader: string
  eyebrow: string
  title: string
  /** Already escaped HTML. */
  lead: string
  /** Label and value pairs shown as a small table. */
  facts?: [string, string][]
  button?: { label: string; href: string }
  /** Already escaped HTML, small print under the card. */
  footer: string
}

/** One email, any message: the same frame for every Visitario mail. */
export function layout(l: Layout) {
  const facts = l.facts?.length
    ? `<tr><td style="padding:20px 0 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:12px;border-collapse:separate">
${l.facts.map(([k, v], i) => `<tr><td style="padding:12px 16px;${i ? `border-top:1px solid ${C.line};` : ''}font:600 13px/18px ${FONT};color:${C.subtle};width:38%">${escape(k)}</td><td style="padding:12px 16px;${i ? `border-top:1px solid ${C.line};` : ''}font:700 14px/20px ${FONT};color:${C.ink}">${escape(v)}</td></tr>`).join('\n')}
</table></td></tr>`
    : ''
  const button = l.button
    ? `<tr><td style="padding-top:24px"><a href="${escape(l.button.href)}" style="display:inline-block;background:${C.forest};color:#ffffff;text-decoration:none;font:700 16px/20px ${FONT};padding:15px 28px;border-radius:12px">${escape(l.button.label)}</a></td></tr>`
    : ''
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${C.ground}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(l.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ground}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px">
<tr><td style="padding:0 4px 20px"><a href="${escape(l.appUrl)}" style="text-decoration:none"><img src="${escape(l.appUrl)}/email/logo.png" width="165" height="32" alt="Visitario" style="display:block;border:0;width:165px;height:32px"></a></td></tr>
<tr><td style="background:${C.card};border-radius:20px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="height:6px;background:${C.lime};font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="font:800 12px/16px ${FONT};letter-spacing:1.2px;text-transform:uppercase;color:${C.subtle}">${escape(l.eyebrow)}</td></tr>
<tr><td style="padding-top:8px;font:800 24px/30px ${FONT};letter-spacing:-0.4px;color:${C.ink}">${escape(l.title)}</td></tr>
<tr><td style="padding-top:10px;font:500 15px/23px ${FONT};color:${C.soft}">${l.lead}</td></tr>
${facts}
${button}
</table></td></tr></table></td></tr>
<tr><td style="padding:20px 8px 0;font:500 12px/18px ${FONT};color:${C.subtle}">${l.footer}</td></tr>
</table></td></tr></table></body></html>`
}

const time = (iso: string) => new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const day = (date: string) => new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00Z`))

export interface Invite { email: string; roles: string[]; expires_at: string; company: string; inviter: string }

/** To the invited person: join the company. */
export function inviteMessage(m: Invite, link: string, appUrl: string) {
  const roles = rolesText(m.roles)
  const until = time(m.expires_at)
  const subject = `${m.inviter} te invitó a ${m.company} en Visitario`
  const text = [
    `${m.inviter} te invitó a sumarte a ${m.company} en Visitario como ${roles}.`,
    '',
    `Aceptá la invitación acá: ${link}`,
    '',
    `El enlace vence en 1 hora (a las ${until}). Si vence, pedile a ${m.inviter} que te la reenvíe.`,
    'Si no esperabas este mail, ignoralo: nadie entra a tu nombre sin este enlace.',
  ].join('\n')
  const html = layout({
    appUrl,
    preheader: `Te suma como ${roles}. El enlace vence a las ${until}.`,
    eyebrow: 'Invitación',
    title: `${m.inviter} te invitó a ${m.company}`,
    lead: `Te suma como <b>${escape(roles)}</b>. Con Visitario vas a ver tus jornadas, registrar las visitas con fotos y mandar el informe del día.`,
    button: { label: 'Aceptar invitación', href: link },
    footer: `El enlace vence en 1 hora (a las ${escape(until)}). Si vence, pedile a ${escape(m.inviter)} que te la reenvíe.<br>Si no esperabas este mail, ignoralo: nadie entra a tu nombre sin este enlace.`,
  })
  return { subject, text, html }
}

export interface Accepted {
  company: string
  person_first: string
  person_last: string
  person_email: string
  roles: string[]
  team: string | null
  starts_on: string
  inviter_first: string | null
  /** It goes to the admin who invited; otherwise to the company's other admins. */
  to_inviter: boolean
}

/** To the admin who invited: the person accepted and is in the company now. */
export function acceptedMessage(n: Accepted, appUrl: string) {
  const hello = n.to_inviter && n.inviter_first ? `${n.inviter_first}, ` : ''
  const who = `${n.person_first} ${n.person_last}`.trim()
  const roles = rolesText(n.roles)
  const subject = `${who} se sumó a ${n.company} en Visitario`
  const facts: [string, string][] = [
    ['Persona', who],
    ['Email', n.person_email],
    ['Rol', roles.charAt(0).toUpperCase() + roles.slice(1)],
    ...(n.team ? [['Equipo', n.team] as [string, string]] : []),
    ['Empieza', day(n.starts_on)],
  ]
  const people = `${appUrl}/s/users`
  const text = [
    `${hello}${who} aceptó ${n.to_inviter ? 'tu invitación' : 'la invitación'} y ya está en ${n.company} como ${roles}.`,
    '',
    ...facts.map(([k, v]) => `${k}: ${v}`),
    '',
    `Ver las personas de la empresa: ${people}`,
  ].join('\n')
  const html = layout({
    appUrl,
    preheader: `Ya está en ${n.company} como ${roles}.`,
    eyebrow: 'Invitación aceptada',
    title: `${who} se sumó a ${n.company}`,
    lead: `${escape(hello)}${escape(n.person_first)} aceptó la invitación y ya está en la empresa como <b>${escape(roles)}</b>.${n.roles.includes('merchandiser') ? ' Ya le podés asignar jornadas.' : ''}`,
    facts,
    button: { label: 'Ver personas', href: people },
    footer: n.to_inviter
      ? `Te llega porque invitaste a ${escape(who)} a ${escape(n.company)} en Visitario.`
      : `Te llega porque sos admin de ${escape(n.company)} en Visitario${n.inviter_first ? ` (la invitación la mandó ${escape(n.inviter_first)})` : ''}.`,
  })
  return { subject, text, html }
}
