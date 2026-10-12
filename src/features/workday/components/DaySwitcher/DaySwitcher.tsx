import { ChevronDown } from 'lucide-react'
import { formatLongDate } from '@/domain/dates'
import styles from './DaySwitcher.module.scss'

/** The date above a page title; opens a list of days to switch to. */
export function DaySwitcher({ date, dates, suffix, onChange }: { date: string; dates: string[]; suffix?: string; onChange: (date: string) => void }) {
  const options = Array.from(new Set([date, ...dates])).sort().reverse()
  return (
    <label className={styles.switcher}>
      <span className={styles.text}>
        {formatLongDate(date)}
        {suffix ? ` · ${suffix}` : ''}
      </span>
      <ChevronDown size={16} aria-hidden />
      <select className={styles.select} value={date} onChange={(e) => onChange(e.target.value)} aria-label="Cambiar de día">
        {options.map((d) => (
          <option key={d} value={d}>{formatLongDate(d)}</option>
        ))}
      </select>
    </label>
  )
}
