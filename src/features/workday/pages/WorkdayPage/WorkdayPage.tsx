import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { todayInArgentina } from '@/domain/dates'
import { Banner } from '@/ui/Banner'
import { useWorkContext } from '@/features/workday/context'
import { workdayQuery } from '@/features/workday/api/queries'
import { NoWorkday } from './NoWorkday'
import { DayView } from './DayView'
import styles from './WorkdayPage.module.scss'

/** "Mi jornada": the day's stores, or how to start one (wireframes Main, A03, AD03, AD04). */
export function WorkdayPage({ date: requested }: { date?: string }) {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const date = requested ?? todayInArgentina()
  const workday = useQuery({ ...workdayQuery(ctx?.companyId ?? '', ctx?.personId ?? '', date), enabled: Boolean(ctx) })
  const goTo = (d: string) => navigate({ to: '/s/workday', search: d === todayInArgentina() ? {} : { date: d } })

  if (!ctx) return null
  if (workday.isError) {
    return (
      <div className={styles.page}>
        <Banner tone="error">No pudimos cargar tu jornada. Revisá la conexión y recargá.</Banner>
      </div>
    )
  }
  if (workday.isPending) return <div className={styles.page} aria-busy="true" />

  return (
    <div className={styles.page}>
      {workday.data ? <DayView ctx={ctx} workday={workday.data} onDateChange={goTo} /> : <NoWorkday ctx={ctx} date={date} onOpen={goTo} />}
    </div>
  )
}
