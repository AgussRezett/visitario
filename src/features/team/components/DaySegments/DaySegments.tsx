import type { TeamMember } from '@/domain/team'
import styles from './DaySegments.module.scss'

/** One bar per day: approved, finished, closed, refused, with fix, in progress, still to do. */
export function DaySegments({ m, height = 8 }: { m: Pick<TeamMember, 'total' | 'visited' | 'approved' | 'needsFix' | 'refused' | 'closed' | 'inProgress'>; height?: number }) {
  const finished = Math.max(m.visited - m.approved - m.refused - m.closed, 0)
  const parts = [
    { key: 'approved', n: m.approved - Math.min(m.approved, m.needsFix) },
    { key: 'done', n: finished },
    { key: 'closed', n: m.closed },
    { key: 'refused', n: m.refused },
    { key: 'fix', n: m.needsFix },
    { key: 'active', n: m.inProgress },
  ]
  const shown = parts.reduce((s, p) => s + p.n, 0)
  const rest = Math.max(m.total - shown, 0)
  return (
    <span className={styles.bar} style={{ height }} role="img" aria-label={`${m.visited} de ${m.total} con resultado`}>
      {parts.map((p) => (p.n ? <span key={p.key} className={styles[p.key]} style={{ flex: p.n }} /> : null))}
      {rest || !m.total ? <span className={styles.rest} style={{ flex: rest || 1 }} /> : null}
    </span>
  )
}
