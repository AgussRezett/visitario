import { Skeleton } from '@/ui/Skeleton'
import styles from './Skeletons.module.scss'

/** Greeting and week strip while the day loads. */
export function HeaderSkeleton() {
  return (
    <div className={styles.header} aria-hidden>
      <Skeleton width="60%" height={28} />
      <Skeleton width="40%" height={16} />
      <div className={styles.week}>
        {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} height={60} shape="block" />)}
      </div>
    </div>
  )
}

/** Hero, numbers and stops, in the shape the day will take. */
export function DaySkeleton() {
  return (
    <div className={styles.day} role="status" aria-label="Cargando la jornada">
      <div className={styles.main}>
        <Skeleton height={228} shape="block" />
        <Skeleton height={72} shape="block" />
        <Skeleton width={160} height={20} />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={styles.row}>
            <Skeleton width={28} height={28} />
            <div className={styles.lines}>
              <Skeleton width="55%" height={16} />
              <Skeleton width="35%" height={12} />
            </div>
            <Skeleton width={72} height={22} shape="round" />
          </div>
        ))}
      </div>
      <div className={styles.aside}>
        <Skeleton height={220} shape="block" />
      </div>
    </div>
  )
}

/** The visit sheet: title, store line and sections. */
export function VisitSkeleton() {
  return (
    <div className={styles.visit} role="status" aria-label="Cargando la visita">
      <Skeleton width="50%" height={28} />
      <Skeleton width="70%" height={16} />
      <div className={styles.columns}>
        {[140, 180, 260, 200].map((h, i) => <Skeleton key={i} height={h} shape="block" />)}
      </div>
    </div>
  )
}

/** The report: numbers and the text box. */
export function ReportSkeleton() {
  return (
    <div className={styles.visit} role="status" aria-label="Cargando el informe">
      <div className={styles.kpis}>
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={72} shape="block" />)}
      </div>
      <Skeleton height={320} shape="block" />
    </div>
  )
}
