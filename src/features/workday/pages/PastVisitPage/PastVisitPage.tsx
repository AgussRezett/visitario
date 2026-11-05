import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { formatDayMonth } from '@/domain/dates'
import { BackLink } from '@/ui/BackLink'
import { Banner } from '@/ui/Banner'
import { StatusChip } from '@/ui/StatusChip'
import { backLabel } from '@/features/shell/back'
import { VisitSkeleton } from '@/features/workday/components/Skeletons'
import { useWorkContext } from '@/features/workday/context'
import { pastVisitQuery } from '@/features/workday/api/history'
import { ReviewDetail } from '@/features/team/components/ReviewDetail'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import styles from './PastVisitPage.module.scss'

/** A past visit of a store of my day, by anyone: what was done, with its photos. Read only. */
export function PastVisitPage({ visitId, from }: { visitId: string; from?: string }) {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const past = useQuery({ ...pastVisitQuery(visitId, ctx?.personId ?? ''), enabled: Boolean(ctx) })
  const v = past.data?.visit
  useDocumentTitle(v ? `Historial: ${v.store.name ?? v.store.address}` : null)
  if (!ctx) return null
  if (past.isPending) return <VisitSkeleton />
  const backTo = from ?? '/s/workday'
  const label = backLabel(backTo)
  if (past.isError || !past.data || !v) {
    return (
      <div className={styles.page}>
        <div className={styles.scroll}>
          <BackLink href={backTo} label={label} />
          <Banner tone="error">{past.isError ? 'No pudimos cargar la visita. Revisá la conexión.' : 'Esa visita no está en el historial de tus locales.'}</Banner>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.appbar}>
        <a href={backTo} className={styles.back} aria-label={`Volver: ${label}`} onClick={(e) => { e.preventDefault(); void navigate({ href: backTo }) }}><ChevronLeft size={24} aria-hidden /></a>
        <span className={styles.titles}>
          <span className={styles.title}>{v.store.name ?? v.store.address}</span>
          <span className={styles.meta}>{formatDayMonth(v.workDate, true)} · {v.merchandiserName.split(' ')[0]}</span>
        </span>
        <StatusChip work={v.workStatus} review={v.reviewStatus} />
      </header>
      <div className={styles.scroll} data-scroll>
        <BackLink href={backTo} label={label} className={styles.desktopBack} />
        <ReviewDetail visit={v} meId={ctx.personId} readOnly work={past.data.work} />
      </div>
    </div>
  )
}
