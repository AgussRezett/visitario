/**
 * A route asked for in words ("12 locales de Mirko en Palermo que reciban bien"), as the AI
 * read it, checked against the company's own lists. Nothing the lists do not have gets
 * through: an unknown seller, zone or person is said back, never guessed.
 */
import { formatLongDate } from './dates'
import { normalize } from './import-columns'
import { GOALS, STOP_COUNTS, type PlanGoal } from './route-plan'
import type { TravelMode } from './route'

export interface PlanCatalog {
  sellers: readonly { id: number; name: string }[]
  channels: readonly { id: number; name: string }[]
  zones: readonly { id: string; name: string }[]
  areas: readonly string[]
  people: readonly { personId: string; firstName: string; lastName: string }[]
}

export interface UnderstoodPlan {
  goal: PlanGoal | null
  sellerIds: number[]
  channelIds: number[]
  areas: string[]
  zoneId: string | null
  minRapport: number | null
  staleDays: number | null
  count: number | null
  mode: TravelMode | null
  personId: string | null
  date: string | null
  /** What the request asked that the lists do not have, to say back. */
  unknown: string[]
  /** What was understood, in words, to check before planning. */
  chips: string[]
}

export const STALE_DAYS = [7, 15, 30, 60] as const
const RAPPORT: Record<string, { min: number; label: string }> = {
  welcoming: { min: 2.5, label: 'Buena onda' },
  restricted: { min: 1.5, label: 'Con restricciones o mejor' },
  indifferent: { min: 0.5, label: 'Indiferente o mejor' },
}

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const text = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 60) : '')
const nearest = (n: number, options: readonly number[]) => options.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a))

/** The AI's answer, kept only where it names what the lists have. */
export function understand(raw: unknown, cat: PlanCatalog, today: string): UnderstoodPlan {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const unknown = list(r.unknown).map(text).filter(Boolean).slice(0, 5)
  const chips: string[] = []

  const goal = GOALS.find((g) => g.value === r.goal)
  if (goal) chips.push(`Objetivo: ${goal.label}`)

  const sellers = cat.sellers.filter((s) => list(r.seller_ids).includes(s.id))
  sellers.forEach((s) => chips.push(`Vendedor: ${s.name}`))
  const channels = cat.channels.filter((c) => list(r.channel_ids).includes(c.id))
  channels.forEach((c) => chips.push(`Canal: ${c.name}`))
  const areas = list(r.areas).map(text).flatMap((a) => cat.areas.filter((x) => normalize(x) === normalize(a)))
  ;[...new Set(areas)].forEach((a) => chips.push(`Barrio: ${a}`))
  const zone = cat.zones.find((z) => z.id === r.zone_id) ?? null
  if (zone) chips.push(`Zona: ${zone.name}`)

  const rapport = typeof r.min_rapport === 'string' ? RAPPORT[r.min_rapport] : undefined
  if (rapport) chips.push(`Trato: ${rapport.label}`)
  const stale = typeof r.stale_days === 'number' && r.stale_days > 0 ? nearest(r.stale_days, STALE_DAYS) : null
  if (stale) chips.push(`Sin activar hace más de ${stale} días`)
  const count = typeof r.count === 'number' && r.count > 0 ? nearest(r.count, STOP_COUNTS) : null
  if (count) chips.push(`${count} locales`)
  const mode = r.mode === 'walking' || r.mode === 'driving' ? r.mode : null
  if (mode) chips.push(mode === 'walking' ? 'A pie' : 'En auto')

  const said = normalize(text(r.merchandiser))
  const person = said ? cat.people.find((p) => normalize(`${p.firstName} ${p.lastName}`).startsWith(said) || normalize(p.firstName) === said.split(' ')[0]) ?? null : null
  if (person) chips.push(`Para: ${person.firstName} ${person.lastName}`)
  else if (said) unknown.push(`el activador "${text(r.merchandiser)}"`)

  const date = typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.date >= today ? r.date : null
  if (date) chips.push(`Día: ${formatLongDate(date).toLowerCase()}`)

  return {
    goal: goal?.value ?? null,
    sellerIds: sellers.map((s) => s.id),
    channelIds: channels.map((c) => c.id),
    areas: [...new Set(areas)],
    zoneId: zone?.id ?? null,
    minRapport: rapport?.min ?? null,
    staleDays: stale,
    count,
    mode,
    personId: person?.personId ?? null,
    date,
    unknown,
    chips,
  }
}
