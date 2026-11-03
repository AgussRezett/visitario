import { addDays, daysBetween } from './dates'

// The reports' period: presets, the one before it to compare, and its working days.

export type PeriodPreset = 'today' | '7d' | '30d' | 'month' | 'prev_month' | '90d' | 'year' | 'custom'

export interface Range {
  from: string
  to: string
}

export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  today: 'Hoy',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  month: 'Este mes',
  prev_month: 'Mes anterior',
  '90d': 'Últimos 90 días',
  year: 'Este año',
  custom: 'Elegir fechas',
}

const monthStart = (date: string) => `${date.slice(0, 7)}-01`
const monthEnd = (date: string) => {
  const [y, m] = date.split('-').map(Number) as [number, number]
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${date.slice(0, 7)}-${String(last).padStart(2, '0')}`
}

/** The dates of a preset, as of `today` (Argentina). "Este mes" runs to the month's end: the rest is projected. */
export function rangeFor(preset: PeriodPreset, today: string, custom?: Range): Range {
  switch (preset) {
    case 'today': return { from: today, to: today }
    case '7d': return { from: addDays(today, -6), to: today }
    case '30d': return { from: addDays(today, -29), to: today }
    case '90d': return { from: addDays(today, -89), to: today }
    case 'month': return { from: monthStart(today), to: monthEnd(today) }
    case 'prev_month': {
      const prev = addDays(monthStart(today), -1)
      return { from: monthStart(prev), to: monthEnd(prev) }
    }
    case 'year': return { from: `${today.slice(0, 4)}-01-01`, to: today }
    case 'custom': return custom && custom.from <= custom.to ? custom : { from: addDays(today, -29), to: today }
  }
}

/** The same number of days right before, to compare with. */
export function previousRange(r: Range): Range {
  const days = daysBetween(r.from, r.to) + 1
  return { from: addDays(r.from, -days), to: addDays(r.from, -1) }
}

/** Every date of the range, in order. */
export function datesOf(r: Range): string[] {
  const out: string[] = []
  for (let d = r.from; d <= r.to && out.length <= 400; d = addDays(d, 1)) out.push(d)
  return out
}

/** Merchandisers work Monday to Saturday. */
export const isWorkingDay = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay() !== 0

/** Working days of a range, split in the ones gone (before today) and the ones to come (today on). */
export function workingDays(r: Range, today: string) {
  const all = datesOf(r).filter(isWorkingDay)
  return { gone: all.filter((d) => d < today), ahead: all.filter((d) => d >= today), all }
}

/** A short name for the range: "1 al 31 de oct.", "12 de oct.". */
export function rangeLabel(r: Range) {
  const f = (d: string, month = true) => new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', day: 'numeric', ...(month ? { month: 'short' } : {}) }).format(new Date(`${d}T12:00:00Z`))
  if (r.from === r.to) return f(r.from)
  const sameMonth = r.from.slice(0, 7) === r.to.slice(0, 7)
  return `${f(r.from, !sameMonth)} al ${f(r.to)}`
}
