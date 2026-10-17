import { formatDayMonth } from '@/domain/dates'
import { RAPPORTS, RAPPORT_SHORT, totalOf, type Distribution } from '@/domain/reputation'
import { RapportLegend } from '@/features/reputation/components/RapportBar'
import styles from './ReputationPage.module.scss'

const pct = (n: number, total: number) => Math.round((n / total) * 100)

/**
 * Week by week, how the rated visits split (100 % stacked columns, best at the top).
 * Each segment tells its numbers on hover; each column reads as a sentence.
 */
export function WeeklyChart({ weeks }: { weeks: { week: string; d: Distribution }[] }) {
  return (
    <section className={styles.card} aria-label="Semana a semana">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Semana a semana</h2>
        <RapportLegend />
      </div>
      <div className={styles.weeks}>
        {weeks.map(({ week, d }) => {
          const total = totalOf(d)
          const summary = total
            ? `Semana del ${formatDayMonth(week)}: ${RAPPORTS.filter((r) => d[r]).map((r) => `${RAPPORT_SHORT[r]} ${pct(d[r], total)} %`).join(', ')} (${total} ${total === 1 ? 'visita' : 'visitas'})`
            : `Semana del ${formatDayMonth(week)}: sin calificaciones`
          return (
            <div key={week} className={styles.week}>
              <span className={styles.column} role="img" aria-label={summary}>
                {total ? (
                  RAPPORTS.filter((r) => d[r]).map((r) => (
                    <i key={r} className={styles.segment} data-level={r} style={{ flexGrow: d[r] }} title={`${RAPPORT_SHORT[r]}: ${d[r]} · ${pct(d[r], total)} %`} />
                  ))
                ) : (
                  <i className={styles.emptyColumn} />
                )}
              </span>
              <span className={styles.weekCount}>{total || '–'}</span>
              <span className={styles.weekLabel}>{formatDayMonth(week)}</span>
            </div>
          )
        })}
      </div>
      <p className={styles.help}>Cada columna es una semana: arriba las visitas con buena onda, abajo las que no quisieron. El número es cuántas se calificaron.</p>
    </section>
  )
}
