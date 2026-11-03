import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { change } from '@/domain/analytics'
import { signed } from '../format'
import styles from './KpiTiles.module.scss'

export interface Kpi {
  label: string
  value: string
  /** The figure and the one of the period before, to say how it changed. */
  now?: number | null
  before?: number | null
  /** Whether going up is good (visits) or bad (refusals). */
  better?: 'up' | 'down'
  note?: string
}

/** The period at a glance: each figure with how it changed against the period before. */
export function KpiTiles({ items, compare }: { items: Kpi[]; compare: boolean }) {
  return (
    <ul className={styles.grid} aria-label="Indicadores del período">
      {items.map((k) => {
        const d = compare ? change(k.now ?? null, k.before ?? null) : null
        const good = d === null || Math.abs(d) < 0.005 ? 'flat' : (d > 0) === (k.better !== 'down') ? 'good' : 'bad'
        const Icon = good === 'flat' ? Minus : d !== null && d > 0 ? ArrowUpRight : ArrowDownRight
        return (
          <li key={k.label} className={styles.tile}>
            <span className={styles.label}>{k.label}</span>
            <span className={styles.value}>{k.value}</span>
            {d !== null ? (
              <span className={styles.delta} data-tone={good}>
                <Icon size={14} aria-hidden />{signed(d)}<span className={styles.vs}>vs. período anterior</span>
              </span>
            ) : k.note ? <span className={styles.note}>{k.note}</span> : null}
          </li>
        )
      })}
    </ul>
  )
}
