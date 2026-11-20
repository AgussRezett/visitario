// The email Visitario gets for each reported problem: plain text first (it reads well on a
// phone), and a simple HTML copy.

export interface Report {
  kind: 'crash' | 'manual'
  message: string
  detail: string | null
  comment: string | null
  url: string | null
  appVersion: string | null
  userAgent: string | null
  who: string
  company: string | null
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)

const when = () => new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' })

export function reportMessage(r: Report, id: string) {
  const what = r.kind === 'crash' ? 'Error en la app' : 'Reporte de un usuario'
  const subject = `Visitario · ${what}: ${r.message.slice(0, 80)}`
  const rows: [string, string | null][] = [
    ['Quién', r.who],
    ['Empresa', r.company],
    ['Cuándo', when()],
    ['Pantalla', r.url],
    ['Versión', r.appVersion],
    ['Dispositivo', r.userAgent],
    ['Comentario', r.comment],
    ['Error', r.message],
  ]
  const shown = rows.filter((row): row is [string, string] => Boolean(row[1]))
  const text = [
    `${what} (${id})`,
    '',
    ...shown.map(([k, v]) => `${k}: ${v}`),
    ...(r.detail ? ['', 'Detalle técnico:', r.detail] : []),
  ].join('\n')
  const html = `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#1d1d1b">
<h2 style="font-size:18px;margin:0 0 12px">${escape(what)}</h2>
<table style="border-collapse:collapse">${shown.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b6b66;vertical-align:top">${escape(k)}</td><td style="padding:4px 0">${escape(v)}</td></tr>`).join('')}</table>
${r.detail ? `<p style="margin:16px 0 4px;color:#6b6b66">Detalle técnico</p><pre style="white-space:pre-wrap;font-size:12px;background:#f3f3ef;padding:12px;border-radius:8px">${escape(r.detail)}</pre>` : ''}
<p style="margin-top:16px;color:#6b6b66;font-size:12px">Reporte ${escape(id)}</p>
</div>`
  return { subject, text, html }
}
