import { Link } from '@tanstack/react-router'
import type { Coverage } from '@/domain/analytics'
import { num, pct } from '../format'
import styles from './CoverageCard.module.scss'

const TONE = ['fresh', 'ok', 'warn', 'late', 'never'] as const

/** How much of the directory the team reaches, by days since the last visit, and who waits the longest. */
export function CoverageCard({ c, from }: { c: Coverage; from: string }) {
  const total = Math.max(1, c.active)
  return (
    <div className={styles.box}>
      <p className={styles.big}><b>{pct(c.share)}</b> del directorio visitado en el período <span>({num(c.visited)} de {num(c.active)} comercios)</span></p>
      <div className={styles.bar} role="img" aria-label={c.buckets.map((b) => `${b.label}: ${b.count}`).join(', ')}>
        {c.buckets.map((b, i) => (b.count ? <span key={b.label} data-tone={TONE[i]} style={{ flexGrow: b.count / total }} /> : null))}
      </div>
      <ul className={styles.legend}>
        {c.buckets.map((b, i) => <li key={b.label}><i data-tone={TONE[i]} />{b.label} <b>{num(b.count)}</b></li>)}
      </ul>
      {c.stale.length ? (
        <>
          <h3 className={styles.subtitle}>Los que más esperan</h3>
          <ul className={styles.stale}>
            {c.stale.map((s) => (
              <li key={s.s}>
                <Link to="/stores/$storeId" params={{ storeId: s.s }} search={{ from }} className={styles.store}>
                  <span className={styles.storeName}>{s.name}</span>
                  <span className={styles.storeMeta}>{s.area ?? 'Sin zona'}</span>
                  <span className={styles.days} data-never={s.days === null || undefined}>{s.days === null ? 'Nunca' : `${num(s.days)} días`}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}
