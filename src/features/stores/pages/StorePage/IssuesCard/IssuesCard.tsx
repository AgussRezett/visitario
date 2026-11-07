import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { issueWhen } from '@/domain/issues'
import { buttonClass } from '@/ui/Button'
import { storeIssuesQuery } from '@/features/issues/api'
import styles from './IssuesCard.module.scss'

const SHOWN = 5

/** The store's latest novedades (open ones first), to see what keeps happening there. */
export function IssuesCard({ storeId, typeName }: { storeId: string; typeName: (id: number) => string }) {
  const issues = useQuery(storeIssuesQuery(storeId))
  const list = [...(issues.data ?? [])].sort((a, b) => (a.status === b.status ? 0 : a.status === 'open' ? -1 : 1)).slice(0, SHOWN)
  if (!list.length) return null
  const open = (issues.data ?? []).filter((i) => i.status === 'open').length
  return (
    <div className={styles.card}>
      <span className={styles.label}>Novedades{open ? ` · ${open} ${open === 1 ? 'abierta' : 'abiertas'}` : ''}</span>
      <ul className={styles.list}>
        {list.map((i) => (
          <li key={i.id} className={styles.item}>
            <span className={styles.name}>{typeName(i.typeId)}</span>
            {i.note ? <span className={styles.note}>{i.note}</span> : null}
            <span className={styles.meta} data-open={i.status === 'open' || undefined}>{issueWhen(i.createdAt)} · {i.by.split(' ')[0]} · {i.status === 'open' ? 'Abierta' : 'Resuelta'}</span>
          </li>
        ))}
      </ul>
      {open ? <Link to="/s/issues" className={buttonClass('ghost', 'sm', styles.all)}>Ir a Novedades</Link> : null}
    </div>
  )
}
