import clsx from 'clsx'
import { RAPPORTS, RAPPORT_POINTS, RAPPORT_SHORT, TREND_LABEL, type Rapport, type Trend } from '@/domain/reputation'
import styles from './RapportLevel.module.scss'

interface RapportLevelProps {
  level: Rapport
  /** Shown after the level: "Empeoró". */
  trend?: Trend
  /** Replaces the short label ("Suele recibir con restricciones"). */
  text?: string
  className?: string
}

/**
 * A store's reputation: a 4-step meter in the brand green (filled up to the level) and
 * its words, so it never depends on color alone.
 */
export function RapportLevel({ level, trend, text, className }: RapportLevelProps) {
  const filled = RAPPORT_POINTS[level] + 1
  const label = text ?? RAPPORT_SHORT[level]
  return (
    <span className={clsx(styles.level, className)} data-level={level}>
      <span className={styles.meter} aria-hidden>
        {RAPPORTS.map((_, i) => <i key={i} className={i < filled ? styles.on : undefined} />)}
      </span>
      <span className={styles.text}>
        {label}
        {trend && trend !== 'new' && trend !== 'steady' ? <span className={styles.trend} data-trend={trend}> · {TREND_LABEL[trend]}</span> : null}
      </span>
    </span>
  )
}
