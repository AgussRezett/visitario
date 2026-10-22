import { Link } from '@tanstack/react-router'
import { ChevronRight, Clock, Users } from 'lucide-react'
import clsx from 'clsx'
import { dayFocus, stopOrigin, stopTiming } from '@/domain/member-day'
import { isVisited, type WorkStatus } from '@/domain/visit'
import { Segmented } from '@/ui/Segmented'
import { StatusChip } from '@/ui/StatusChip'
import type { Visit } from '@/features/workday/api/queries'
import styles from './MemberStops.module.scss'

export type MemberFilter = 'all' | 'todo' | 'done'

const NUMBER_TONE: Record<WorkStatus, string | undefined> = {
  pending: undefined,
  in_progress: styles.numActive,
  done: styles.numDone,
  refused: styles.numRefused,
  closed: styles.numClosed,
}

interface MemberStopsProps {
  /** The whole day, in the activador's order. */
  stops: Visit[]
  filter: MemberFilter
  onFilter: (f: MemberFilter) => void
  /** The activador's first name, for the copy. */
  member: string
  operationStops: Set<string>
}

/** An activador's stores in their own order, read-only: where they are, what is next, what is done. */
export function MemberStops({ stops, filter, onFilter, member, operationStops }: MemberStopsProps) {
  const todo = stops.filter((v) => !isVisited(v.workStatus)).length
  const focus = dayFocus(stops)
  const shown = filter === 'all' ? stops : stops.filter((v) => (filter === 'done' ? isVisited(v.workStatus) : !isVisited(v.workStatus)))

  return (
    <section className={styles.section} aria-label={`Locales de ${member} en su orden`}>
      <div className={styles.head}>
        <h2 className={styles.title}>Locales en su orden</h2>
        <Segmented
          label="Mostrar"
          value={filter}
          onChange={onFilter}
          options={[
            { value: 'all', label: `Todos ${stops.length}` },
            { value: 'todo', label: `Por hacer ${todo}` },
            { value: 'done', label: `Hechos ${stops.length - todo}` },
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <p className={styles.empty}>{filter === 'todo' ? `A ${member} no le queda ningún local por hacer.` : `${member} todavía no terminó ningún local.`}</p>
      ) : (
        <ol className={styles.list}>
          {shown.map((v) => {
            const n = stops.indexOf(v) + 1
            const when = stopTiming(v)
            const mark = v.id === focus.currentId ? 'Ahora acá' : v.id === focus.nextId ? 'Sigue' : null
            const body = (
              <>
                <span className={clsx(styles.num, NUMBER_TONE[v.workStatus])}>{n}</span>
                <span className={styles.body}>
                  <span className={styles.row}>
                    <span className={styles.name}>{v.store.name ?? v.store.address}</span>
                    {mark ? <span className={clsx(styles.mark, v.id === focus.currentId && styles.markNow)}>{mark}</span> : null}
                  </span>
                  <span className={styles.sub}>{[v.store.name ? v.store.address : null, v.store.area].filter(Boolean).join(' · ')}</span>
                  <span className={styles.sub}>
                    {[stopOrigin(v, member), v.task].filter(Boolean).join(' · ')}
                    {operationStops.has(v.id) ? <span className={styles.team}><Users size={13} aria-hidden />Operativo</span> : null}
                  </span>
                  {when ? <span className={styles.when}><Clock size={13} aria-hidden />{when}</span> : null}
                </span>
                <span className={styles.end}>
                  <StatusChip work={v.workStatus} review={v.reviewStatus} />
                  {isVisited(v.workStatus) ? <ChevronRight size={18} aria-hidden className={styles.go} /> : null}
                </span>
              </>
            )
            return (
              <li key={v.id}>
                {/* Finished visits open in Revisión; the rest are still the activador's to do. */}
                {isVisited(v.workStatus) ? (
                  <Link to="/review/$visitId" params={{ visitId: v.id }} className={clsx(styles.item, styles.link)}>{body}</Link>
                ) : (
                  <div className={clsx(styles.item, v.id === focus.currentId && styles.itemNow)}>{body}</div>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
