import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { History, MapPinPlus, MessageSquareWarning, Plus } from 'lucide-react'
import { isVisited, workdayProgress } from '@/domain/visit'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Refreshing } from '@/ui/Refreshing'
import type { WorkContext } from '@/features/workday/context'
import { dayMetricsQuery, resumableQuery, useCatalogs, visitsQuery, type Workday } from '@/features/workday/api/queries'
import { useVisitList } from '@/features/sync/hooks'
import { AddAddressSheet } from '../AddAddressSheet'
import { ResumeSheet } from '../ResumeSheet'
import { DayHero } from '../DayHero'
import { DayStats } from '../DayStats'
import { StopList, type StopFilter } from '../StopList'
import { ReportPanel, ResumePanel } from '../SidePanels'
import { useDismissPending } from '../useDismissPending'
import { DaySkeleton } from '@/features/workday/components/Skeletons'
import { MainOverlay } from '@/features/shell/components/AppShell'
import styles from './DayView.module.scss'

/** Which sheet is open; the page header opens them too. */
export type DaySheet = 'add' | 'resume' | null

interface DayViewProps {
  ctx: WorkContext
  workday: Workday
  sheet: DaySheet
  onSheet: (sheet: DaySheet) => void
}

/** The day's stores with the next one up front (wireframes Main / AD04). The header lives in the page. */
export function DayView({ ctx, workday, sheet, onSheet }: DayViewProps) {
  const [filter, setFilter] = useState<StopFilter>('all')
  const visits = useQuery({ ...visitsQuery(workday.id, ctx.personId), placeholderData: keepPreviousData })
  const resumable = useQuery({ ...resumableQuery(ctx.companyId, workday.workDate), placeholderData: keepPreviousData })
  const totals = useQuery({ ...dayMetricsQuery(ctx.companyId, ctx.personId, workday.workDate), placeholderData: keepPreviousData })
  const setAdding = (open: boolean) => onSheet(open ? 'add' : null)
  const setResuming = (open: boolean) => onSheet(open ? 'resume' : null)
  const adding = sheet === 'add'
  const resuming = sheet === 'resume'
  const catalogs = useCatalogs(ctx.companyId)
  const { dismissAll, dialog } = useDismissPending()

  const list = useVisitList(visits.data) ?? []
  const progress = workdayProgress(list)
  const fixes = list.filter((v) => v.reviewStatus === 'needs_fix')
  const next = list.find((v) => v.workStatus === 'in_progress') ?? list.find((v) => v.workStatus === 'pending')
  const shown = filter === 'all' ? list : list.filter((v) => (filter === 'done' ? isVisited(v.workStatus) : !isVisited(v.workStatus)))
  const pending = resumable.data ?? []

  const sheets = (
    <>
      <AddAddressSheet open={adding} onClose={() => setAdding(false)} ctx={ctx} workdayId={workday.id} date={workday.workDate} />
      <ResumeSheet open={resuming} onClose={() => setResuming(false)} ctx={ctx} date={workday.workDate} workdayId={workday.id} visits={pending} onDone={() => setResuming(false)} />
    </>
  )

  if (visits.isPending) return <DaySkeleton />
  if (visits.isError) {
    return (
      <>
        <Banner tone="error" title="No pudimos cargar los locales">
          <span>Revisá la conexión y volvé a intentar.</span>
          <Button variant="secondary" size="sm" className={styles.retry} onClick={() => visits.refetch()}>Reintentar</Button>
        </Banner>
      </>
    )
  }

  if (list.length === 0) {
    return (
      <>
        <section className={styles.empty}>
          <span className={styles.emptyIcon}><MapPinPlus size={28} aria-hidden /></span>
          <h2 className={styles.emptyTitle}>Tu jornada está abierta y vacía</h2>
          <p className={styles.emptyLead}>
            Agregá los locales que vas a visitar: buscalos en el directorio, cargá uno nuevo o pegá varias direcciones de una.
          </p>
          <div className={styles.emptyActions}>
            <Button size="md" onClick={() => setAdding(true)}><Plus size={18} aria-hidden />Agregar dirección</Button>
            {pending.length ? (
              <Button variant="secondary" size="md" onClick={() => setResuming(true)}>
                <History size={18} aria-hidden />Retomar {pending.length} {pending.length === 1 ? 'pendiente' : 'pendientes'}
              </Button>
            ) : null}
          </div>
        </section>
        {sheets}
      </>
    )
  }

  return (
    <Refreshing active={visits.isPlaceholderData}>
      <div className={styles.layout}>
        <div className={styles.main}>
          {fixes.length ? (
            <Banner tone="warn" icon={<MessageSquareWarning size={18} aria-hidden />} title={fixes.length === 1 ? 'Te pidieron una corrección' : `Te pidieron ${fixes.length} correcciones`}>
              <span className={styles.fixLinks}>
                {fixes.map((v) => (
                  <Link key={v.id} to="/visit/$visitId" params={{ visitId: v.id }} className={styles.fixLink}>{v.store.name ?? v.store.address}</Link>
                ))}
              </span>
            </Banner>
          ) : null}
          <DayHero progress={progress} next={next} stop={next ? list.indexOf(next) + 1 : 0} date={workday.workDate} />
          <DayStats visits={list} />
          <StopList visits={shown} all={list} filter={filter} onFilter={setFilter} />
          <div className={styles.phoneOnly}>
            <ResumePanel items={pending} onResume={() => setResuming(true)} onDismissAll={() => void dismissAll(pending.map((v) => v.visit_id))} />
          </div>
        </div>
        <aside className={styles.aside}>
          <ReportPanel date={workday.workDate} visited={progress.visited} catalogs={catalogs.data} totals={totals.data ?? {}} />
          <ResumePanel items={pending} onResume={() => setResuming(true)} onDismissAll={() => void dismissAll(pending.map((v) => v.visit_id))} />
        </aside>
      </div>

      <MainOverlay>
        <Button size="md" className={styles.fabButton} onClick={() => setAdding(true)}>
          <Plus size={20} aria-hidden />Agregar dirección
        </Button>
      </MainOverlay>
      {sheets}
      {dialog}
    </Refreshing>
  )
}
