import { indexOf, type Distribution } from '@/domain/reputation'
import { RapportBar } from '@/features/reputation/components/RapportBar'
import styles from './ReputationPage.module.scss'

export interface GroupRow {
  id: string
  label: string
  d: Distribution
  total: number
  score: number
  stores: number
}

/** One row per area or merchandiser: its bar, index and how much it rests on; worst first. */
export function GroupList({ title, rows, help }: { title: string; rows: GroupRow[]; help: string }) {
  return (
    <section className={styles.card} aria-label={title}>
      <h2 className={styles.cardTitle}>{title}</h2>
      {rows.length ? (
        <ul className={styles.groups}>
          {rows.map((g) => (
            <li key={g.id} className={styles.group}>
              <span className={styles.groupHead}>
                <span className={styles.groupName}>{g.label}</span>
                <span className={styles.groupIndex}>{indexOf(g.score)}<small>/100</small></span>
              </span>
              <RapportBar d={g.d} label={g.label} />
              <span className={styles.groupMeta}>{g.total} {g.total === 1 ? 'visita' : 'visitas'} · {g.stores} {g.stores === 1 ? 'comercio' : 'comercios'}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.help}>Sin calificaciones en el período.</p>
      )}
      <p className={styles.help}>{help}</p>
    </section>
  )
}
