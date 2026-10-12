import { ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { addDays, dayOfMonth, formatLongDate, todayInArgentina, weekOf, weekdayInitial } from '@/domain/dates'
import type { WorkdaySummary } from '@/features/workday/api/queries'
import styles from './WeekStrip.module.scss'

interface WeekStripProps {
  date: string
  days: WorkdaySummary[]
  onSelect: (date: string) => void
}

/** The week around the selected day; a dot says how each worked day went. */
export function WeekStrip({ date, days, onSelect }: WeekStripProps) {
  const today = todayInArgentina()
  const byDate = new Map(days.map((d) => [d.workDate, d]))
  const week = weekOf(date)

  const state = (d: string) => {
    const s = byDate.get(d)
    if (!s || s.total === 0) return null
    if (s.pending === 0) return 'done'
    return d < today ? 'left' : 'open'
  }
  const describe = (d: string) => {
    const s = byDate.get(d)
    if (!s || s.total === 0) return 'sin jornada'
    if (s.pending === 0) return `${s.total} locales, todos con resultado`
    return `${s.visited} de ${s.total} visitados`
  }

  return (
    <nav className={styles.strip} aria-label="Días de la semana">
      <button type="button" className={styles.arrow} onClick={() => onSelect(addDays(week[0] ?? date, -7))} aria-label="Semana anterior">
        <ChevronLeft size={18} aria-hidden />
      </button>
      <ol className={styles.days}>
        {week.map((d) => {
          const s = state(d)
          return (
            <li key={d}>
              <button
                type="button"
                className={clsx(styles.day, d === date && styles.selected, d === today && styles.today)}
                aria-current={d === date ? 'date' : undefined}
                aria-label={`${formatLongDate(d)}${d === today ? ', hoy' : ''}: ${describe(d)}`}
                onClick={() => onSelect(d)}
              >
                <span className={styles.initial}>{weekdayInitial(d)}</span>
                <span className={styles.number}>{dayOfMonth(d)}</span>
                <span className={clsx(styles.dot, s && styles[s])} aria-hidden />
              </button>
            </li>
          )
        })}
      </ol>
      <button type="button" className={styles.arrow} onClick={() => onSelect(addDays(week[6] ?? date, 1))} aria-label="Semana siguiente">
        <ChevronRight size={18} aria-hidden />
      </button>
    </nav>
  )
}
