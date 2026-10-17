import { addDays, todayInArgentina } from '@/domain/dates'
import { distribution, effectiveRapport, expectText, indexOf, type Rapport, type StoreReputation } from '@/domain/reputation'
import { RapportBar, RapportLegend } from '@/features/reputation/components/RapportBar'
import { RapportLevel } from '@/features/reputation/components/RapportLevel'
import styles from './ReputationCard.module.scss'

interface ReputationCardProps {
  reputation: StoreReputation | undefined
  /** The store's visits that I can see (a supervisor: their team's). */
  visits: { workDate: string; rapport: Rapport | null; consent: string | null }[]
}

/** How the store receives the merchandisers: its level, trend and the last 90 days. */
export function ReputationCard({ reputation, visits }: ReputationCardProps) {
  const since = addDays(todayInArgentina(), -90)
  const rated = visits.flatMap((v) => {
    const r = v.workDate >= since ? effectiveRapport(v) : null
    return r ? [{ rapport: r, visits: 1 }] : []
  })
  const d = distribution(rated)

  return (
    <section className={styles.card} aria-label="Reputación">
      <div className={styles.head}>
        <span className={styles.label}>Reputación</span>
        {reputation ? <span className={styles.index}>{indexOf(reputation.score)}<small>/100</small></span> : null}
      </div>
      {reputation ? (
        <>
          <RapportLevel level={reputation.level} trend={reputation.trend} text={expectText(reputation.level)} />
          <RapportBar d={d} label="Últimos 90 días" />
          <RapportLegend />
          <span className={styles.help}>
            {rated.length} {rated.length === 1 ? 'visita calificada' : 'visitas calificadas'} en 90 días. El nivel sale de las últimas {reputation.rated}; las no autorizadas cuentan como "No quiso".
          </span>
        </>
      ) : (
        <span className={styles.help}>Todavía sin calificaciones. Los activadores marcan cómo los reciben al cargar la autorización.</span>
      )}
    </section>
  )
}
