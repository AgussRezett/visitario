import clsx from 'clsx'
import { RAPPORTS, RAPPORT_SHORT, totalOf, type Distribution } from '@/domain/reputation'
import styles from './RapportBar.module.scss'

const pct = (n: number, total: number) => Math.round((n / total) * 100)

/**
 * How a set of visits received the merchandisers, as one stacked bar (best to worst)
 * with a 2 px gap between segments. Each segment says its numbers on hover, and the
 * whole bar reads as a sentence for screen readers.
 */
export function RapportBar({ d, label, className, thin }: { d: Distribution; label: string; className?: string; thin?: boolean }) {
  const total = totalOf(d)
  const summary = total
    ? `${label}: ${RAPPORTS.filter((r) => d[r]).map((r) => `${RAPPORT_SHORT[r]} ${d[r]} (${pct(d[r], total)} %)`).join(', ')}`
    : `${label}: sin calificaciones`
  return (
    <span className={clsx(styles.bar, thin && styles.thin, className)} role="img" aria-label={summary}>
      {total ? (
        RAPPORTS.filter((r) => d[r]).map((r) => (
          <i key={r} className={styles.segment} data-level={r} style={{ flexGrow: d[r] }} title={`${RAPPORT_SHORT[r]}: ${d[r]} ${d[r] === 1 ? 'visita' : 'visitas'} · ${pct(d[r], total)} %`} />
        ))
      ) : (
        <i className={styles.empty} />
      )}
    </span>
  )
}

/** The legend for every bar on the screen: the four levels, best to worst. */
export function RapportLegend({ className }: { className?: string }) {
  return (
    <ul className={clsx(styles.legend, className)} aria-label="Referencias">
      {RAPPORTS.map((r) => (
        <li key={r}><i className={styles.swatch} data-level={r} aria-hidden />{RAPPORT_SHORT[r]}</li>
      ))}
    </ul>
  )
}
