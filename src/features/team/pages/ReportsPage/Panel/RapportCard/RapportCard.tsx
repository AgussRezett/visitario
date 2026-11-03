import { RAPPORTS, RAPPORT_LABEL, type Rapport } from '@/domain/reputation'
import { num, pct } from '../format'
import styles from './RapportCard.module.scss'

/** How the stores received the team: the share of each answer, best to worst. */
export function RapportCard({ counts }: { counts: Record<Rapport, number> }) {
  const total = RAPPORTS.reduce((n, r) => n + counts[r], 0)
  if (!total) return <p className={styles.empty}>Sin datos de trato en el período: se cargan en cada visita (¿Cómo te recibieron?).</p>
  return (
    <div className={styles.box}>
      <div className={styles.bar} role="img" aria-label={RAPPORTS.map((r) => `${RAPPORT_LABEL[r]}: ${counts[r]}`).join(', ')}>
        {RAPPORTS.map((r) => (counts[r] ? <span key={r} data-rapport={r} style={{ flexGrow: counts[r] }} /> : null))}
      </div>
      <ul className={styles.list}>
        {RAPPORTS.map((r) => (
          <li key={r}>
            <i data-rapport={r} />
            <span className={styles.label}>{RAPPORT_LABEL[r]}</span>
            <b>{pct(counts[r] / total)}</b>
            <span className={styles.count}>{num(counts[r])}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
