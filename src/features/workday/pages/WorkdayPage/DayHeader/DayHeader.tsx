import type { ReactNode } from 'react'
import { formatLongDate, greeting, todayInArgentina } from '@/domain/dates'
import type { WorkContext } from '@/features/workday/context'
import type { WorkdaySummary } from '@/features/workday/api/queries'
import { WeekStrip } from '@/features/workday/components/WeekStrip'
import styles from './DayHeader.module.scss'

interface DayHeaderProps {
  ctx: WorkContext
  date: string
  days: WorkdaySummary[]
  onDateChange: (date: string) => void
  actions?: ReactNode
}

/** Greeting, the selected day and the week to move around. */
export function DayHeader({ ctx, date, days, onDateChange, actions }: DayHeaderProps) {
  const isToday = date === todayInArgentina()
  return (
    <header className={styles.header}>
      <div className={styles.top}>
        <div className={styles.titles}>
          <h1 className={styles.title}>{greeting()}, {ctx.firstName}</h1>
          <p className={styles.sub}>
            {isToday ? `Hoy, ${formatLongDate(date).toLowerCase()}` : formatLongDate(date)} · {ctx.personal ? 'Jornada propia' : ctx.companyName}
          </p>
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      <div className={styles.week}>
        <WeekStrip date={date} days={days} onSelect={onDateChange} />
      </div>
    </header>
  )
}
