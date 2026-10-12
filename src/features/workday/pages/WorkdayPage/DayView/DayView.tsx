import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, MapPinPlus, Plus } from 'lucide-react'
import { isVisited, workdayProgress } from '@/domain/visit'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import type { WorkContext } from '@/features/workday/context'
import { dayMetricsQuery, historyQuery, resumableQuery, useCatalogs, visitsQuery, type Workday } from '@/features/workday/api/queries'
import { AddAddressSheet } from '../AddAddressSheet'
import { ResumeSheet } from '../ResumeSheet'
import { DayHeader } from '../DayHeader'
import { DayHero } from '../DayHero'
import { DayStats } from '../DayStats'
import { StopList, type StopFilter } from '../StopList'
import { ReportPanel, ResumePanel } from '../SidePanels'
import { DaySkeleton } from '@/features/workday/components/Skeletons'
import styles from './DayView.module.scss'

interface DayViewProps {
  ctx: WorkContext
  workday: Workday
  onDateChange: (date: string) => void
}

/** The day's stores with the next one up front (wireframes Main / AD04). */
export function DayView({ ctx, workday, onDateChange }: DayViewProps) {
  const [adding, setAdding] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [filter, setFilter] = useState<StopFilter>('all')
  const visits = useQuery(visitsQuery(workday.id, ctx.personId))
  const history = useQuery(historyQuery(ctx.companyId, ctx.personId))
  const resumable = useQuery(resumableQuery(ctx.companyId, workday.workDate))
  const totals = useQuery(dayMetricsQuery(ctx.companyId, ctx.personId, workday.workDate))
  const catalogs = useCatalogs(ctx.companyId)

  const list = visits.data ?? []
  const progress = workdayProgress(list)
  const next = list.find((v) => v.workStatus === 'in_progress') ?? list.find((v) => v.workStatus === 'pending')
  const shown = filter === 'all' ? list : list.filter((v) => (filter === 'done' ? isVisited(v.workStatus) : !isVisited(v.workStatus)))
  const pending = resumable.data ?? []

  const header = (
    <DayHeader
      ctx={ctx}
      date={workday.workDate}
      days={history.data ?? []}
      onDateChange={onDateChange}
      actions={
        <>
          {pending.length ? (
            <Button variant="secondary" size="md" onClick={() => setResuming(true)}>
              <History size={18} aria-hidden />Retomar pendientes
            </Button>
          ) : null}
          <Button size="md" onClick={() => setAdding(true)}>
            <Plus size={18} aria-hidden />Agregar dirección
          </Button>
        </>
      }
    />
  )

  const sheets = (
    <>
      <AddAddressSheet open={adding} onClose={() => setAdding(false)} ctx={ctx} workdayId={workday.id} date={workday.workDate} />
      <ResumeSheet open={resuming} onClose={() => setResuming(false)} ctx={ctx} date={workday.workDate} workdayId={workday.id} visits={pending} onDone={() => setResuming(false)} />
    </>
  )

  if (visits.isPending) return <>{header}<DaySkeleton /></>
  if (visits.isError) {
    return (
      <>
        {header}
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
        {header}
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
    <>
      {header}
      <div className={styles.layout}>
        <div className={styles.main}>
          <DayHero progress={progress} next={next} stop={next ? list.indexOf(next) + 1 : 0} date={workday.workDate} />
          <DayStats visits={list} />
          <StopList visits={shown} all={list} filter={filter} onFilter={setFilter} />
          <div className={styles.phoneOnly}>
            <ResumePanel items={pending} onResume={() => setResuming(true)} />
          </div>
        </div>
        <aside className={styles.aside}>
          <ReportPanel date={workday.workDate} visited={progress.visited} catalogs={catalogs.data} totals={totals.data ?? {}} />
          <ResumePanel items={pending} onResume={() => setResuming(true)} />
        </aside>
      </div>

      <div className={styles.fab}>
        <Button size="md" className={styles.fabButton} onClick={() => setAdding(true)}>
          <Plus size={20} aria-hidden />Agregar dirección
        </Button>
      </div>
      {sheets}
    </>
  )
}
