/**
 * How much AI a company and each person may still use (captures and route requests alike). Visitario sets the company's month,
 * the company admin sets each person's day; whichever runs out first closes it.
 */
export interface AiQuota {
  monthUsed: number
  monthLimit: number
  myToday: number
  /** Null: no daily limit per person. */
  myDailyLimit: number | null
}

export type QuotaClosedBy = 'plan' | 'month' | 'day'

/** Captures left right now, and the limit that is closer. */
export function quotaLeft(q: AiQuota): { left: number; by: QuotaClosedBy } {
  if (q.monthLimit <= 0) return { left: 0, by: 'plan' }
  const month = Math.max(0, q.monthLimit - q.monthUsed)
  const day = q.myDailyLimit == null ? Infinity : Math.max(0, q.myDailyLimit - q.myToday)
  return day < month ? { left: day, by: 'day' } : { left: month, by: 'month' }
}

const uses = (n: number) => `${n} ${n === 1 ? 'uso' : 'usos'} de IA`

/** One line under the capture button: what is left, or why it is closed. */
export function quotaText(q: AiQuota): string {
  const { left, by } = quotaLeft(q)
  if (by === 'plan') return 'La lectura con IA no está incluida en el plan de tu empresa.'
  if (!left) return by === 'day' ? 'Ya usaste la IA todo lo permitido por hoy: mañana se renueva.' : 'Tu empresa usó toda la IA del mes: se renueva el 1.'
  return by === 'day' ? `Te ${left === 1 ? 'queda' : 'quedan'} ${uses(left)} hoy.` : `${left === 1 ? 'Queda' : 'Quedan'} ${uses(left)} este mes en tu empresa.`
}

/** The month's use as a share of its limit, 0 to 100, for the admin's bar. */
export const monthShare = (used: number, limit: number) => (limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100)

/** The first day of next month, when the month's captures come back ("1 de diciembre"). */
export function renewsOn(today: string): string {
  const [y, m] = today.split('-').map(Number) as [number, number]
  const next = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1))
  return `1 de ${next.toLocaleDateString('es-AR', { month: 'long', timeZone: 'UTC' })}`
}
