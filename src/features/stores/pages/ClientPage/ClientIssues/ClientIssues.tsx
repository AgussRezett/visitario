import { useQuery } from '@tanstack/react-query'
import { storeIssuesQuery, useResolveIssue } from '@/features/issues/api'
import { IssueCard } from '@/features/issues/pages/IssuesPage/IssueCard'
import styles from './ClientIssues.module.scss'

/** The client's open novedades, for its seller to close from here. */
export function ClientIssues({ storeId, typeName }: { storeId: string; typeName: (id: number) => string }) {
  const issues = useQuery(storeIssuesQuery(storeId))
  const resolve = useResolveIssue()
  const open = (issues.data ?? []).filter((i) => i.status === 'open')
  if (!open.length) return null
  return (
    <section className={styles.section} aria-label="Novedades abiertas">
      <h2 className={styles.title}>Novedades abiertas · {open.length}</h2>
      {open.map((i) => (
        <IssueCard key={i.id} issue={i} typeName={typeName(i.typeId)} seller={null} channel={null} asSeller inClient
          busy={resolve.isPending && resolve.variables?.id === i.id}
          onResolve={(note) => resolve.mutateAsync({ id: i.id, resolved: true, note })}
          onReopen={() => resolve.mutate({ id: i.id, resolved: false })} />
      ))}
    </section>
  )
}
