import type { DayPoint } from '@/domain/analytics'
import { project, trend } from '@/domain/forecast'
import { num, pct, signed } from '../format'
import styles from './WorkCard.module.scss'

interface Props {
  metrics: { id: number; name: string }[]
  totals: Record<number, number>
  before: Record<number, number> | null
  points: DayPoint[]
  today: string
  brands: { name: string; visits: number; share: number }[]
}

/** A line of a day series, small: the shape of the period at a glance. */
function Spark({ values }: { values: number[] }) {
  const max = Math.max(1, ...values)
  const w = 120
  const h = 28
  const step = values.length > 1 ? w / (values.length - 1) : w
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join(' ')
  return (
    <svg className={styles.spark} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/** The work done (the company's own numbers) with where they end at this pace, and the brands seen. */
export function WorkCard({ metrics, totals, before, points, today, brands }: Props) {
  return (
    <div className={styles.box}>
      {metrics.length ? (
        <ul className={styles.metrics}>
          {metrics.map((m) => {
            const series = points.map((p) => ({ date: p.date, value: p.metrics[m.id] ?? 0 }))
            const p = project(series, today)
            const t = trend(series, today)
            const prev = before?.[m.id]
            return (
              <li key={m.id} className={styles.metric}>
                <span className={styles.metricName}>{m.name}</span>
                <span className={styles.metricValue}>{num(totals[m.id] ?? 0)}</span>
                <Spark values={series.map((s) => s.value)} />
                <span className={styles.metricNote}>
                  {p ? <>Al ritmo actual: <b>~{num(p.projected)}</b> al cierre</> : prev !== undefined && prev !== null ? <>Antes: {num(prev)}</> : null}
                  {t !== null && Math.abs(t) >= 0.02 ? <> · {t > 0 ? 'subiendo' : 'bajando'} {signed(t)} por semana</> : null}
                </span>
              </li>
            )
          })}
        </ul>
      ) : <p className={styles.empty}>La empresa no tiene números de trabajo cargados (se definen en Catálogos).</p>}

      {brands.length ? (
        <div className={styles.brands}>
          <h3 className={styles.subtitle}>Marcas trabajadas <span>de las visitas activadas</span></h3>
          <ul className={styles.list}>
            {brands.slice(0, 8).map((b) => (
              <li key={b.name} className={styles.row}>
                <span className={styles.name} title={b.name}>{b.name}</span>
                <span className={styles.track} aria-hidden><span style={{ width: `${b.share * 100}%` }} /></span>
                <span className={styles.value}>{pct(b.share)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
