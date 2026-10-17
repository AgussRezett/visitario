import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import type { StoreReputation } from '@/domain/reputation'
import { RapportLevel } from '@/features/reputation/components/RapportLevel'
import styles from './ReputationPage.module.scss'

/** Stores whose last 3 ratings came out clearly worse than the 3 before. */
export function WorsenedList({ stores }: { stores: { id: string; name: string; area: string | null; rep: StoreReputation }[] }) {
  return (
    <section className={styles.card} aria-label="Empeoraron">
      <h2 className={styles.cardTitle}>Empeoraron</h2>
      {stores.length ? (
        <ul className={styles.stores}>
          {stores.map((s) => (
            <li key={s.id}>
              <Link to="/stores/$storeId" params={{ storeId: s.id }} className={styles.store}>
                <span className={styles.storeText}>
                  <span className={styles.groupName}>{s.name}</span>
                  <RapportLevel level={s.rep.level} trend="worse" />
                </span>
                <ChevronRight size={18} aria-hidden className={styles.chevron} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.help}>Ningún comercio empeoró en sus últimas visitas.</p>
      )}
      <p className={styles.help}>Las últimas 3 visitas calificadas contra las 3 anteriores.</p>
    </section>
  )
}
