import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { History, Plus } from 'lucide-react'
import { todayInArgentina } from '@/domain/dates'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Refreshing } from '@/ui/Refreshing'
import { useWorkContext } from '@/features/workday/context'
import { historyQuery, resumableQuery, workdayQuery } from '@/features/workday/api/queries'
import { usePrefetchWeek } from '@/features/workday/api/prefetch'
import { reportFor } from '@/features/sync/outbox'
import { DaySkeleton } from '@/features/workday/components/Skeletons'
import { DayHeader } from './DayHeader'
import { NoWorkday } from './NoWorkday'
import { DayView, type DaySheet } from './DayView'
import styles from './WorkdayPage.module.scss'

/**
 * "Mi jornada": the day's stores, or how to start one (wireframes Main, A03, AD03, AD04).
 * The header and the week stay put when the date changes; only the day below updates.
 */
export function WorkdayPage({ date: requested }: { date?: string }) {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const date = requested ?? todayInArgentina()
  const companyId = ctx?.companyId ?? ''
  const personId = ctx?.personId ?? ''
  const on = Boolean(ctx)
  const workday = useQuery({ ...workdayQuery(companyId, personId, date), enabled: on, placeholderData: keepPreviousData })
  const history = useQuery({ ...historyQuery(companyId, personId), enabled: on })
  const resumable = useQuery({ ...resumableQuery(companyId, date), enabled: on, placeholderData: keepPreviousData })
  const [sheet, setSheet] = useState<DaySheet>(null)
  usePrefetchWeek(companyId, personId, date, history.data)
  useEffect(() => {
    if (companyId) reportFor(companyId) // the supervisor sees this phone is up to date
  }, [companyId])

  if (!ctx) return null
  const goTo = (d: string) => navigate({ to: '/s/workday', search: d === todayInArgentina() ? {} : { date: d } })
  const switching = workday.isPlaceholderData
  const pending = resumable.data ?? []

  let body
  if (workday.isError) body = <Banner tone="error">No pudimos cargar tu jornada. Revisá la conexión y recargá.</Banner>
  else if (workday.isPending) body = <DaySkeleton />
  else if (workday.data) body = <DayView ctx={ctx} workday={workday.data} sheet={sheet} onSheet={setSheet} />
  else body = <NoWorkday ctx={ctx} date={date} onOpen={goTo} />

  return (
    <div className={styles.page}>
      <DayHeader
        ctx={ctx}
        date={date}
        days={history.data ?? []}
        onDateChange={goTo}
        actions={
          workday.data && !switching ? (
            <>
              {pending.length ? (
                <Button variant="secondary" size="md" onClick={() => setSheet('resume')}>
                  <History size={18} aria-hidden />Retomar pendientes
                </Button>
              ) : null}
              <Button size="md" onClick={() => setSheet('add')}>
                <Plus size={18} aria-hidden />Agregar dirección
              </Button>
            </>
          ) : undefined
        }
      />
      <Refreshing active={switching} className={styles.body}>{body}</Refreshing>
    </div>
  )
}
