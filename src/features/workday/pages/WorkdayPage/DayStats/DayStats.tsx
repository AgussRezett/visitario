import type { Visit } from '@/features/workday/api/queries'
import { isVisited } from '@/domain/visit'
import styles from './DayStats.module.scss'

/** Four numbers that say how the day is going, in one strip. */
export function DayStats({ visits }: { visits: Visit[] }) {
  const toDo = visits.filter((v) => !isVisited(v.workStatus)).length
  const closed = visits.filter((v) => v.workStatus === 'closed' || v.workStatus === 'refused').length
  const displays = visits.flatMap((v) => v.displays.map((d) => v.photos.some((p) => p.displayId === d.id && p.kind === 'after')))
  const arranged = displays.filter(Boolean).length
  const photos = visits.reduce((n, v) => n + v.photos.length, 0)
  const extras = visits.filter((v) => v.source === 'added').length

  const cells = [
    { value: toDo, label: 'por hacer' },
    { value: closed, label: 'cerrados o sin autorizar' },
    { value: displays.length ? `${arranged}/${displays.length}` : '0', label: 'exhibiciones acomodadas' },
    { value: photos, label: photos === 1 ? 'foto' : 'fotos' },
    { value: extras, label: extras === 1 ? 'agregada por vos' : 'agregadas por vos', desktop: true },
  ]
  return (
    <dl className={styles.stats}>
      {cells.map((c) => (
        <div key={c.label} className={c.desktop ? styles.desktopCell : styles.cell}>
          <dt className={styles.label}>{c.label}</dt>
          <dd className={styles.value}>{c.value}</dd>
        </div>
      ))}
    </dl>
  )
}
