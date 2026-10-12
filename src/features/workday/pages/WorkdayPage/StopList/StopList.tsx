import { Link } from '@tanstack/react-router'
import { Camera, ChevronRight, Clock, LayoutGrid } from 'lucide-react'
import clsx from 'clsx'
import { formatHour, formatTime } from '@/domain/dates'
import { isVisited, type WorkStatus } from '@/domain/visit'
import { Segmented } from '@/ui/Segmented'
import { StatusChip } from '@/ui/StatusChip'
import { Table } from '@/ui/Table'
import type { Visit } from '@/features/workday/api/queries'
import styles from './StopList.module.scss'

export type StopFilter = 'all' | 'todo' | 'done'

const NUMBER_TONE: Record<WorkStatus, string | undefined> = {
  pending: undefined,
  in_progress: styles.numActive,
  done: styles.numDone,
  refused: styles.numRefused,
  closed: styles.numClosed,
}

/** When something happened at the store, in a few words. */
function timing(v: Visit) {
  if (v.workStatus === 'closed' && v.retryAfter) return `Vuelve ${formatHour(v.retryAfter)}`
  if (isVisited(v.workStatus) && v.finishedAt) return `Terminó ${formatTime(v.finishedAt)}`
  if (v.workStatus === 'in_progress' && v.arrivedAt) return `Llegó ${formatTime(v.arrivedAt)}`
  return null
}

function displayCount(v: Visit) {
  const arranged = v.displays.filter((d) => v.photos.some((p) => p.displayId === d.id && p.kind === 'after')).length
  return v.displays.length ? `${arranged}/${v.displays.length}` : null
}

interface StopListProps {
  visits: Visit[]
  all: Visit[]
  filter: StopFilter
  onFilter: (f: StopFilter) => void
}

/** The day's stores: cards on phones, a table on desktop, same filter. */
export function StopList({ visits, all, filter, onFilter }: StopListProps) {
  const todo = all.filter((v) => !isVisited(v.workStatus)).length
  const stop = (v: Visit) => all.indexOf(v) + 1

  return (
    <section className={styles.section} aria-label="Locales">
      <div className={styles.head}>
        <h2 className={styles.title}>Locales en orden</h2>
        <div className={styles.filter}>
          <Segmented
            label="Mostrar"
            value={filter}
            onChange={onFilter}
            options={[
              { value: 'all', label: `Todos ${all.length}` },
              { value: 'todo', label: `Por hacer ${todo}` },
              { value: 'done', label: `Hechos ${all.length - todo}` },
            ]}
          />
        </div>
      </div>

      {visits.length === 0 ? (
        <p className={styles.empty}>{filter === 'todo' ? 'No te queda ningún local por hacer.' : 'Todavía no terminaste ningún local.'}</p>
      ) : (
        <>
          <ul className={styles.cards}>
            {visits.map((v) => {
              const count = displayCount(v)
              const when = timing(v)
              return (
                <li key={v.id}>
                  <Link to="/visit/$visitId" params={{ visitId: v.id }} className={styles.card}>
                    <span className={clsx(styles.num, NUMBER_TONE[v.workStatus])}>{stop(v)}</span>
                    <span className={styles.body}>
                      <span className={styles.row}>
                        <span className={styles.name}>{v.store.name ?? v.store.address}</span>
                        <StatusChip work={v.workStatus} review={v.reviewStatus} />
                      </span>
                      <span className={styles.address}>
                        {[v.store.name ? v.store.address : null, v.store.area].filter(Boolean).join(' · ') || (v.source === 'added' ? 'Agregada por vos' : '')}
                      </span>
                      {v.task ? <span className={styles.task}>{v.task}</span> : null}
                      {count || v.photos.length || when ? (
                        <span className={styles.meta}>
                          {count ? <span><LayoutGrid size={14} aria-hidden />{count} exhib.</span> : null}
                          {v.photos.length ? <span><Camera size={14} aria-hidden />{v.photos.length}</span> : null}
                          {when ? <span><Clock size={14} aria-hidden />{when}</span> : null}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>

          <Table className={styles.table} label="Locales de la jornada">
            <thead>
              <tr><th>#</th><th>Comercio</th><th>Tarea</th><th>Exhibiciones</th><th>Fotos</th><th>Horario</th><th>Estado</th><th /></tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id}>
                  <td><span className={clsx(styles.num, NUMBER_TONE[v.workStatus])}>{stop(v)}</span></td>
                  <td>
                    <Link to="/visit/$visitId" params={{ visitId: v.id }} className={styles.cellLink}>
                      <span className={styles.cellName}>{v.store.name ?? v.store.address}</span>
                      <span className={styles.cellSub}>
                        {[v.store.name ? v.store.address : null, v.store.area, v.source === 'added' ? 'agregada por vos' : null].filter(Boolean).join(' · ')}
                      </span>
                    </Link>
                  </td>
                  <td className={styles.small}>{v.task ?? <span className={styles.none}>Sin tarea</span>}</td>
                  <td className={styles.small}>{displayCount(v) ?? <span className={styles.none}>—</span>}</td>
                  <td className={styles.small}>{v.photos.length || <span className={styles.none}>—</span>}</td>
                  <td className={styles.small}>{timing(v) ?? <span className={styles.none}>—</span>}</td>
                  <td><StatusChip work={v.workStatus} review={v.reviewStatus} /></td>
                  <td>
                    <Link to="/visit/$visitId" params={{ visitId: v.id }} className={styles.open} aria-label={`Abrir ${v.store.name ?? v.store.address}`}>
                      <ChevronRight size={18} aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </section>
  )
}
