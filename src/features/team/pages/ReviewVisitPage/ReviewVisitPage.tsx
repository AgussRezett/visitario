import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { formatTime } from '@/domain/dates'
import { Banner } from '@/ui/Banner'
import { StatusChip } from '@/ui/StatusChip'
import { VisitSkeleton } from '@/features/workday/components/Skeletons'
import { useWorkContext } from '@/features/workday/context'
import { teamVisitQuery, type TeamVisit } from '@/features/team/api/queries'
import { ReviewButtons, ReviewDetail, useReviewDraft } from '@/features/team/components/ReviewDetail'
import styles from './ReviewVisitPage.module.scss'

/** On phones: one visit to review, with approve / fix always at hand at the bottom (SM02). */
export function ReviewVisitPage({ visitId }: { visitId: string }) {
  const ctx = useWorkContext()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const fromList = () => {
    for (const [, list] of qc.getQueriesData<TeamVisit[]>({ queryKey: ['team', 'review'] })) {
      const found = list?.find((v) => v.id === visitId)
      if (found) return found
    }
    return undefined
  }
  const visit = useQuery({ ...teamVisitQuery(visitId, ctx?.personId ?? ''), enabled: Boolean(ctx), initialData: fromList })
  const draft = useReviewDraft()
  useEffect(() => draft.reset(), [visitId]) // eslint-disable-line react-hooks/exhaustive-deps -- a new visit starts a new draft
  if (!ctx) return null
  if (visit.isPending) return <VisitSkeleton />
  const v = visit.data
  if (!v) return <div className={styles.page}><Banner tone="error">Esa visita no existe o no es de tu equipo.</Banner></div>

  /** After a decision: the next one waiting, or back to the list. */
  const next = () => {
    const queue = qc.getQueriesData<TeamVisit[]>({ queryKey: ['team', 'review'] }).flatMap(([, l]) => l ?? [])
    const following = queue.find((x) => x.id !== v.id && x.reviewStatus === 'unreviewed')
    void navigate(following ? { to: '/review/$visitId', params: { visitId: following.id }, replace: true } : { to: '/s/review' })
  }

  return (
    <div className={styles.page}>
      <header className={styles.appbar}>
        <Link to="/s/review" className={styles.back} aria-label="Volver a la revisión"><ChevronLeft size={24} aria-hidden /></Link>
        <span className={styles.titles}>
          <span className={styles.title}>{v.store.name ?? v.store.address}</span>
          <span className={styles.meta}>{v.merchandiserName.split(' ')[0]}{v.finishedAt ? ` · ${formatTime(v.finishedAt)}` : ''}</span>
        </span>
        <StatusChip work={v.workStatus} review={v.reviewStatus} />
      </header>
      <div className={styles.scroll} data-scroll>
        <ReviewDetail key={v.id} visit={v} meId={ctx.personId} draft={draft} />
      </div>
      <div className={styles.footer}>
        <ReviewButtons visit={v} meId={ctx.personId} draft={draft} onDone={next} />
      </div>
    </div>
  )
}
