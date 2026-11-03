import { useState } from 'react'
import clsx from 'clsx'
import type { DayPoint } from '@/domain/analytics'
import { isWorkingDay } from '@/domain/report-period'
import { addDays } from '@/domain/dates'
import { num } from '../format'
import styles from './DailyChart.module.scss'

interface Column {
  key: string
  label: string
  title: string
  done: number
  refused: number
  closed: number
  pending: number
  /** A day still to come: the expected pace, drawn as a ghost bar. */
  ghost?: number
}

const SERIES = [
  { key: 'done', label: 'Activadas' },
  { key: 'refused', label: 'No autorizadas' },
  { key: 'closed', label: 'Cerrados' },
] as const

const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', ...o }).format(new Date(`${d}T12:00:00Z`))

/** Days, or weeks when the period is long, with what is ahead at the current pace. */
function columns(points: DayPoint[], today: string, rate: number | null): Column[] {
  if (points.length <= 62) {
    return points.map((p) => ({
      key: p.date,
      label: fmt(p.date, { day: 'numeric' }),
      title: fmt(p.date, { weekday: 'long', day: 'numeric', month: 'long' }),
      done: p.done, refused: p.refused, closed: p.closed, pending: p.pending,
      ghost: p.date > today && rate && isWorkingDay(p.date) ? rate : undefined,
    }))
  }
  const weeks = new Map<string, Column>()
  for (const p of points) {
    const monday = addDays(p.date, -((new Date(`${p.date}T12:00:00Z`).getUTCDay() + 6) % 7))
    const c = weeks.get(monday) ?? { key: monday, label: fmt(monday, { day: 'numeric', month: 'short' }), title: `Semana del ${fmt(monday, { day: 'numeric', month: 'long' })}`, done: 0, refused: 0, closed: 0, pending: 0 }
    c.done += p.done
    c.refused += p.refused
    c.closed += p.closed
    c.pending += p.pending
    weeks.set(monday, c)
  }
  return [...weeks.values()]
}

/** Visits with a result per day, stacked by how they ended; days ahead show the expected pace. */
export function DailyChart({ points, today, rate }: { points: DayPoint[]; today: string; rate: number | null }) {
  const cols = columns(points, today, rate)
  const [hover, setHover] = useState<string | null>(null)
  const max = Math.max(1, ...cols.map((c) => Math.max(c.done + c.refused + c.closed, c.ghost ?? 0)))
  const ticks = [0, Math.round(max / 2), max]
  const shown = cols.find((c) => c.key === hover)
  const every = Math.ceil(cols.length / 12)

  return (
    <div className={styles.chart}>
      <ul className={styles.legend} aria-label="Referencias">
        {SERIES.map((s) => <li key={s.key}><span className={styles.swatch} data-series={s.key} />{s.label}</li>)}
        {rate ? <li><span className={clsx(styles.swatch, styles.ghostSwatch)} />Lo que viene, al ritmo actual</li> : null}
      </ul>
      <div className={styles.plot}>
        <div className={styles.axis} aria-hidden>
          {[...ticks].reverse().map((t) => <span key={t}>{num(t)}</span>)}
        </div>
        <div className={styles.bars} role="list" aria-label="Visitas por día" onMouseLeave={() => setHover(null)}>
          {cols.map((c, i) => {
            const total = c.done + c.refused + c.closed
            return (
              <div key={c.key} role="listitem" tabIndex={0} className={clsx(styles.col, hover === c.key && styles.on)}
                aria-label={`${c.title}: ${total} con resultado, ${c.done} activadas, ${c.refused} no autorizadas, ${c.closed} cerrados`}
                onMouseEnter={() => setHover(c.key)} onFocus={() => setHover(c.key)} onBlur={() => setHover(null)}>
                <div className={styles.stack}>
                  {c.ghost && !total ? <span className={styles.ghost} style={{ height: `${(c.ghost / max) * 100}%` }} /> : null}
                  {SERIES.map((s) => (c[s.key] ? <span key={s.key} className={styles.seg} data-series={s.key} style={{ height: `${(c[s.key] / max) * 100}%` }} /> : null))}
                </div>
                <span className={styles.tick} aria-hidden>{i % every === 0 ? c.label : ''}</span>
              </div>
            )
          })}
        </div>
        {shown ? (
          <div className={styles.tip} role="status">
            <b>{shown.title}</b>
            <span>{num(shown.done + shown.refused + shown.closed)} con resultado{shown.pending ? ` · ${num(shown.pending)} sin visitar` : ''}</span>
            {SERIES.map((s) => <span key={s.key}><i className={styles.swatch} data-series={s.key} />{s.label}: {num(shown[s.key])}</span>)}
            {shown.ghost ? <span>Esperadas: ~{num(shown.ghost, 1)}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
