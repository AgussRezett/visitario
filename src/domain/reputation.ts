// Reputation with customers: how each store's buyer receives the merchandisers.
// One optional rating per visit; a refused visit counts as 'unwilling' when not rated.
import type { Enums } from '@/lib/supabase'

export type Rapport = Enums<'rapport_kind'>

/** Best to worst: the order of every list, legend and stacked bar. */
export const RAPPORTS: Rapport[] = ['welcoming', 'restricted', 'indifferent', 'unwilling']

/** What the merchandiser taps. */
export const RAPPORT_LABEL: Record<Rapport, string> = {
  welcoming: 'Libre y con buena onda',
  restricted: 'Con restricciones',
  indifferent: 'Con indiferencia',
  unwilling: 'No quiso que activemos',
}

/** Short, for chips, legends and tables. */
export const RAPPORT_SHORT: Record<Rapport, string> = {
  welcoming: 'Buena onda',
  restricted: 'Con restricciones',
  indifferent: 'Indiferente',
  unwilling: 'No quiso',
}

export const RAPPORT_POINTS: Record<Rapport, number> = { welcoming: 3, restricted: 2, indifferent: 1, unwilling: 0 }

/** The level an average of points stands for. */
export function levelOf(score: number): Rapport {
  if (score >= 2.5) return 'welcoming'
  if (score >= 1.5) return 'restricted'
  if (score >= 0.5) return 'indifferent'
  return 'unwilling'
}

/** 0 to 100: the share of the best possible treatment. */
export const indexOf = (score: number) => Math.round((score / 3) * 100)

export type Trend = 'better' | 'worse' | 'steady' | 'new'

/** The last 3 ratings against the 3 before: a change of most of a level counts. */
export function trendOf(recent: number | null, previous: number | null): Trend {
  if (recent === null || previous === null) return 'new'
  if (recent - previous <= -0.75) return 'worse'
  if (recent - previous >= 0.75) return 'better'
  return 'steady'
}

export const TREND_LABEL: Record<Trend, string> = { better: 'Mejoró', worse: 'Empeoró', steady: 'Estable', new: 'Pocos datos' }

export interface StoreReputation {
  storeId: string
  level: Rapport
  score: number
  trend: Trend
  rated: number
  lastRated: string | null
}

/** A row of store_reputation as the screens use it. */
export function toStoreReputation(r: { store_id: string; score: number | string | null; recent: number | string | null; previous: number | string | null; rated: number; last_rated: string | null }): StoreReputation | null {
  if (r.score === null) return null
  const num = (x: number | string | null) => (x === null ? null : Number(x))
  const score = Number(r.score)
  return { storeId: r.store_id, level: levelOf(score), score, trend: trendOf(num(r.recent), num(r.previous)), rated: r.rated, lastRated: r.last_rated }
}

/** What the merchandiser reads before going in: "Suele recibir con restricciones". */
export function expectText(level: Rapport): string {
  return {
    welcoming: 'Suele recibir con buena onda',
    restricted: 'Suele recibir con restricciones',
    indifferent: 'Suele recibir con indiferencia',
    unwilling: 'Suele no querer que activemos',
  }[level]
}

// ---- The dashboard, from rapport_facts rows

export interface RapportFact {
  week: string
  storeId: string
  storeName: string
  area: string | null
  merchandiserId: string
  merchandiserName: string
  rapport: Rapport
  visits: number
}

export type Distribution = Record<Rapport, number>

const empty = (): Distribution => ({ welcoming: 0, restricted: 0, indifferent: 0, unwilling: 0 })

export function distribution(facts: readonly Pick<RapportFact, 'rapport' | 'visits'>[]): Distribution {
  const d = empty()
  for (const f of facts) d[f.rapport] += f.visits
  return d
}

export const totalOf = (d: Distribution) => RAPPORTS.reduce((n, r) => n + d[r], 0)

/** Average points of a distribution, or null without ratings. */
export function scoreOf(d: Distribution): number | null {
  const n = totalOf(d)
  return n ? RAPPORTS.reduce((s, r) => s + d[r] * RAPPORT_POINTS[r], 0) / n : null
}

/** Ratings per week, every week of the period present (empty ones too), oldest first. */
export function weekly(facts: readonly RapportFact[], weeks: readonly string[]): { week: string; d: Distribution }[] {
  return weeks.map((week) => ({ week, d: distribution(facts.filter((f) => f.week === week)) }))
}

/** Rows grouped by a key (area, merchandiser), with their distribution and score, worst first. */
export function groupBy(facts: readonly RapportFact[], key: (f: RapportFact) => { id: string; label: string }) {
  const groups = new Map<string, { id: string; label: string; facts: RapportFact[] }>()
  for (const f of facts) {
    const k = key(f)
    const g = groups.get(k.id) ?? { ...k, facts: [] }
    g.facts.push(f)
    groups.set(k.id, g)
  }
  return [...groups.values()]
    .map((g) => {
      const d = distribution(g.facts)
      return { id: g.id, label: g.label, d, total: totalOf(d), score: scoreOf(d) ?? 0, stores: new Set(g.facts.map((f) => f.storeId)).size }
    })
    .sort((a, b) => a.score - b.score || b.total - a.total)
}

/** Monday of the week of a date (yyyy-mm-dd), as Postgres date_trunc('week') gives it. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T12:00:00Z`)
  const back = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - back)
  return d.toISOString().slice(0, 10)
}

/** The Mondays of the last `count` weeks up to `today`, oldest first. */
export function lastWeeks(today: string, count: number): string[] {
  const end = new Date(`${weekStart(today)}T12:00:00Z`)
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(end)
    d.setUTCDate(d.getUTCDate() - 7 * (count - 1 - i))
    return d.toISOString().slice(0, 10)
  })
}

/** The rating that counts for a visit: the one marked, or 'unwilling' if the store said no. */
export function effectiveRapport(v: { rapport: Rapport | null; consent: string | null }): Rapport | null {
  return v.rapport ?? (v.consent === 'refused' ? 'unwilling' : null)
}

/** The Mondays from the week of `from` to the week of `to`, oldest first. */
export function weeksBetween(from: string, to: string): string[] {
  const span = (Date.parse(`${weekStart(to)}T12:00:00Z`) - Date.parse(`${weekStart(from)}T12:00:00Z`)) / (7 * 86_400_000)
  return lastWeeks(to, Math.round(span) + 1)
}
