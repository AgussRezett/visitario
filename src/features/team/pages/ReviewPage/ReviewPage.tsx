import { useEffect } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Inbox } from 'lucide-react'
import { formatDayMonth, formatTime, todayInArgentina } from '@/domain/dates'
import { useIsDesktop } from '@/lib/useMedia'
import { Banner } from '@/ui/Banner'
import { Field } from '@/ui/Field'
import { Refreshing } from '@/ui/Refreshing'
import { Segmented } from '@/ui/Segmented'
import { Skeleton } from '@/ui/Skeleton'
import { StatusChip } from '@/ui/StatusChip'
import { useWorkContext } from '@/features/workday/context'
import { reviewCountsQuery, reviewQuery, teamVisitQuery, type ReviewTab, type TeamVisit } from '@/features/team/api/queries'
import { ReviewButtons, ReviewDetail, useReviewDraft } from '@/features/team/components/ReviewDetail'
import styles from './ReviewPage.module.scss'

// Short labels on the phone, so each tab fits on one line with its count.
const REVIEW_TABS: { value: ReviewTab; label: string; short: string }[] = [
  { value: 'to_review', label: 'Por revisar', short: 'Revisar' },
  { value: 'needs_fix', label: 'Con corrección', short: 'Corregir' },
  { value: 'approved', label: 'Aprobadas', short: 'Aprobadas' },
  { value: 'all', label: 'Todas', short: 'Todas' },
]

export interface ReviewSearch {
  tab?: ReviewTab
  visit?: string
  date?: string
}

/** Review inbox: the list, and on desktop the selected visit beside it (S02 / S09). */
export function ReviewPage({ tab = 'to_review', visit: selected, date: requested }: ReviewSearch) {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const desktop = useIsDesktop()
  const date = requested ?? todayInArgentina()
  const on = Boolean(ctx)
  const companyId = ctx?.companyId ?? ''
  const personId = ctx?.personId ?? ''
  const list = useQuery({ ...reviewQuery(companyId, personId, tab, date), enabled: on, placeholderData: keepPreviousData })
  const counts = useQuery({ ...reviewCountsQuery(companyId, personId, date), enabled: on })
  const visits = list.data ?? []
  const current = selected ?? (desktop ? visits[0]?.id : undefined)

  const go = (search: ReviewSearch) => navigate({ to: '/s/review', search: { tab: search.tab ?? tab, visit: search.visit, date: 'date' in search ? search.date : requested }, replace: true })
  // "Por revisar" and "Con corrección" span every day; the other two are for one day.
  const byDay = tab === 'approved' || tab === 'all'
  const today = todayInArgentina()
  if (!ctx) return null

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.titles}>
          <span className={styles.eyebrow}>Revisión</span>
          <h1 className={styles.title}>{tab === 'to_review' ? 'Por revisar' : tab === 'needs_fix' ? 'Con corrección' : `Visitas del ${formatDayMonth(date)}`}</h1>
        </div>
        {byDay ? (
          <div className={styles.date}>
            <Field label="Día" type="date" value={date} max={today}
              onChange={(e) => e.target.value && go({ date: e.target.value === today ? undefined : e.target.value, visit: undefined })} />
          </div>
        ) : (
          <p className={styles.scope}>De todos los días, las más viejas primero.</p>
        )}
      </header>

      <Segmented
        label="Qué ver"
        value={tab}
        onChange={(t) => go({ tab: t })}
        options={REVIEW_TABS.map((t) => {
          const name = desktop ? t.label : t.short
          return { value: t.value, label: counts.data ? `${name}${desktop ? ' · ' : ' '}${counts.data[t.value]}` : name }
        })}
      />

      {list.isError ? <Banner tone="error">No pudimos cargar las visitas. Revisá la conexión.</Banner> : null}

      <div className={styles.split}>
        <Refreshing active={list.isPlaceholderData} className={styles.listColumn}>
          {list.isPending ? (
            <div className={styles.skeletons}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={64} />)}</div>
          ) : visits.length ? (
            <ul className={styles.list}>
              {visits.map((v) => (
                <li key={v.id}>
                  <VisitRow v={v} active={desktop && v.id === current} desktop={desktop} tab={tab} date={requested} />
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.empty}>
              <Inbox size={28} aria-hidden />
              <p>{tab === 'to_review' ? 'No hay visitas esperando revisión.' : tab === 'needs_fix' ? 'No hay correcciones pendientes.' : 'No hay visitas para mostrar.'}</p>
            </div>
          )}
        </Refreshing>

        {desktop ? (
          <div className={styles.detailColumn}>
            {current ? (
              <SelectedVisit
                key={current}
                visitId={current}
                meId={personId}
                fallback={visits.find((v) => v.id === current)}
                onDone={() => {
                  const i = visits.findIndex((v) => v.id === current)
                  const next = visits[i + 1] ?? visits[i - 1]
                  go({ visit: next && next.id !== current ? next.id : undefined })
                }}
              />
            ) : (
              <p className={styles.pick}>Elegí una visita de la lista.</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function VisitRow({ v, active, desktop, tab, date }: { v: TeamVisit; active: boolean; desktop: boolean; tab: ReviewTab; date: string | undefined }) {
  const body = (
    <>
      <span className={styles.rowBody}>
        <span className={styles.rowTitle}>{v.store.name ?? v.store.address}</span>
        <span className={styles.rowMeta}>
          {v.merchandiserName.split(' ')[0]} · {v.workDate !== todayInArgentina() ? `${formatDayMonth(v.workDate)} · ` : ''}
          {v.finishedAt ? formatTime(v.finishedAt) : 'sin terminar'}
          {v.source === 'added' ? ' · extra' : ''}
        </span>
      </span>
      <StatusChip work={v.workStatus} review={v.reviewStatus} />
    </>
  )
  return desktop ? (
    <Link to="/s/review" search={{ tab, visit: v.id, date }} replace className={styles.row} data-active={active || undefined} aria-current={active ? 'true' : undefined}>{body}</Link>
  ) : (
    <Link to="/review/$visitId" params={{ visitId: v.id }} className={styles.row}>{body}</Link>
  )
}

function SelectedVisit({ visitId, meId, fallback, onDone }: { visitId: string; meId: string; fallback: TeamVisit | undefined; onDone: () => void }) {
  const qc = useQueryClient()
  const visit = useQuery({ ...teamVisitQuery(visitId, meId), initialData: fallback, initialDataUpdatedAt: () => qc.getQueryState(['team', 'review'])?.dataUpdatedAt })
  const draft = useReviewDraft()
  useEffect(() => draft.reset(), [visitId]) // eslint-disable-line react-hooks/exhaustive-deps -- a new visit starts a new draft
  if (!visit.data) return visit.isPending ? <Skeleton height={320} /> : <Banner tone="error">No encontramos esa visita.</Banner>
  return (
    <div className={styles.selected}>
      <ReviewDetail visit={visit.data} meId={meId} draft={draft} />
      <ReviewButtons visit={visit.data} meId={meId} draft={draft} onDone={onDone} />
    </div>
  )
}
