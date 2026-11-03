import { isWorkingDay } from './report-period'

// Estimates for the reports: where the period ends at this pace, and where it is heading.

export interface Projection {
  /** What there is so far. */
  actual: number
  /** At this pace, at the end of the period. */
  projected: number
  /** A likely range around it (one standard deviation of the working days so far). */
  low: number
  high: number
  /** Per working day so far. */
  rate: number
  /** Working days left, today included. */
  remaining: number
}

/**
 * The period's end at the pace of the working days already gone (today is still running,
 * so it counts as ahead, plus what it already has). Null when nothing is left to project
 * or there is no day to learn from.
 */
export function project(series: { date: string; value: number }[], today: string): Projection | null {
  const work = series.filter((p) => isWorkingDay(p.date))
  const gone = work.filter((p) => p.date < today)
  const ahead = work.filter((p) => p.date >= today)
  if (!ahead.length || !gone.length) return null
  const actual = series.reduce((n, p) => n + p.value, 0)
  const rate = gone.reduce((n, p) => n + p.value, 0) / gone.length
  const sd = Math.sqrt(gone.reduce((n, p) => n + (p.value - rate) ** 2, 0) / gone.length)
  const todaySoFar = series.find((p) => p.date === today)?.value ?? 0
  // Today: what is missing for an average day, never negative.
  const rest = Math.max(rate - todaySoFar, 0) + rate * (ahead.length - 1)
  const spread = sd * Math.sqrt(ahead.length)
  const projected = Math.round(actual + rest)
  return { actual, projected, low: Math.max(actual, Math.round(projected - spread)), high: Math.round(projected + spread), rate, remaining: ahead.length }
}

/**
 * Where a daily series is heading: the least-squares slope over working days, as change per
 * week relative to its average (+0.08 = growing 8 % a week). Null with fewer than 10 days or
 * less than one a day on average: too little to say a direction.
 */
export function trend(series: { date: string; value: number }[], today: string): number | null {
  const pts = series.filter((p) => isWorkingDay(p.date) && p.date < today)
  if (pts.length < 10) return null
  const n = pts.length
  const mean = pts.reduce((s, p) => s + p.value, 0) / n
  if (mean < 1) return null
  const xm = (n - 1) / 2
  let num = 0
  let den = 0
  pts.forEach((p, i) => {
    num += (i - xm) * (p.value - mean)
    den += (i - xm) ** 2
  })
  return ((num / den) * 6) / mean // 6 working days a week
}
