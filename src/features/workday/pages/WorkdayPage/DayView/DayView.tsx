import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Camera, History, Plus } from 'lucide-react'
import clsx from 'clsx'
import { isVisited, workdayProgress, type WorkStatus } from '@/domain/visit'
import { formatHour } from '@/domain/dates'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { StatusChip } from '@/ui/StatusChip'
import { Table } from '@/ui/Table'
import type { WorkContext } from '@/features/workday/context'
import { historyQuery, resumableQuery, visitsQuery, type Visit, type Workday } from '@/features/workday/api/queries'
import { DaySwitcher } from '@/features/workday/components/DaySwitcher'
import { AddAddressSheet } from '../AddAddressSheet'
import { ResumeSheet } from '../ResumeSheet'
import { originLabel } from '@/features/workday/visit-text'
import styles from './DayView.module.scss'

interface DayViewProps {
  ctx: WorkContext
  workday: Workday
  onDateChange: (date: string) => void
}

function subline(v: Visit) {
  if (v.workStatus === 'closed' && v.retryAfter) return `Volver después de las ${formatHour(v.retryAfter)}`
  return [v.store.name ? v.store.address : v.store.area, originLabel(v)].filter(Boolean).join(' · ')
}

/** The day's stores in order, with the next one highlighted (wireframes Main / AD04). */
export function DayView({ ctx, workday, onDateChange }: DayViewProps) {
  const [adding, setAdding] = useState(false)
  const [resuming, setResuming] = useState(false)
  const visits = useQuery(visitsQuery(workday.id, ctx.personId))
  const history = useQuery(historyQuery(ctx.companyId, ctx.personId))
  const resumable = useQuery(resumableQuery(ctx.companyId, workday.workDate))
  const list = visits.data ?? []
  const progress = workdayProgress(list)
  const next = list.find((v) => v.workStatus === 'in_progress') ?? list.find((v) => v.workStatus === 'pending')
  const later = list.filter((v) => v !== next && !isVisited(v.workStatus))
  const finished = list.filter((v) => isVisited(v.workStatus))
  const stop = (v: Visit) => list.indexOf(v) + 1
  const canResume = Boolean(resumable.data?.length)

  const breakdown = [
    progress.approved && `${progress.approved} aprobadas`,
    progress.done && `${progress.done} terminadas`,
    progress.closed && `${progress.closed} cerrados`,
    progress.refused && `${progress.refused} no autorizadas`,
    progress.inProgress && `${progress.inProgress} en curso`,
  ].filter(Boolean)

  return (
    <>
      <div className={styles.top}>
        <div className={styles.titles}>
          <DaySwitcher date={workday.workDate} dates={(history.data ?? []).map((d) => d.workDate)} onChange={onDateChange} suffix={ctx.companyName} />
          <h1 className={styles.title}>Mi jornada</h1>
        </div>
        <div className={styles.actions}>
          {canResume ? (
            <Button variant="secondary" size="md" onClick={() => setResuming(true)}>
              <History size={18} aria-hidden />Retomar pendientes
            </Button>
          ) : null}
          <Button size="md" onClick={() => setAdding(true)}>
            <Plus size={18} aria-hidden />Agregar dirección
          </Button>
        </div>
      </div>

      {visits.isError ? <Banner tone="error">No pudimos cargar los locales. Revisá la conexión.</Banner> : null}

      <Card className={styles.progress}>
        <div className={styles.progressHead}>
          <span className={styles.progressTitle}>{progress.visited} de {progress.total} visitados</span>
          <span className={styles.percent}>{progress.percent} %</span>
        </div>
        <div className={styles.bar} aria-hidden>
          <i style={{ width: `${(progress.approved / (progress.total || 1)) * 100}%` }} />
          <i className={styles.barDone} style={{ width: `${((progress.done + progress.refused) / (progress.total || 1)) * 100}%` }} />
          <i className={styles.barClosed} style={{ width: `${(progress.closed / (progress.total || 1)) * 100}%` }} />
        </div>
        <span className={styles.breakdown}>{breakdown.length ? breakdown.join(' · ') : 'Todavía sin visitas con resultado'}</span>
      </Card>

      {list.length === 0 && visits.isSuccess ? (
        <Card className={styles.empty}>
          <span className={styles.emptyTitle}>Tu jornada está vacía</span>
          <span className={styles.emptyLead}>Agregá las direcciones que vas a visitar{canResume ? ' o retomá las pendientes' : ''}.</span>
          <div className={styles.emptyActions}>
            <Button size="md" onClick={() => setAdding(true)}><Plus size={18} aria-hidden />Agregar dirección</Button>
            {canResume ? <Button variant="secondary" size="md" onClick={() => setResuming(true)}>Retomar pendientes</Button> : null}
          </div>
        </Card>
      ) : null}

      <div className={styles.columns}>
        <section className={styles.listColumn} aria-label="Locales">
          {next ? (
            <div className={styles.phoneOnly}>
              <div className={styles.sectionHead}><span className={styles.eyebrow}>Siguiente</span></div>
              <NextCard visit={next} stop={stop(next)} />
            </div>
          ) : null}

          {later.length ? (
            <div className={styles.phoneOnly}>
              <div className={styles.sectionHead}><span className={styles.eyebrow}>Después · {later.length}</span></div>
              <StopRows visits={later} stop={stop} />
            </div>
          ) : null}
          {finished.length ? (
            <div className={styles.phoneOnly}>
              <div className={styles.sectionHead}><span className={styles.eyebrow}>Hechas · {finished.length}</span></div>
              <StopRows visits={finished} stop={stop} />
            </div>
          ) : null}
          {canResume ? (
            <Button variant="ghost" size="md" className={styles.phoneResume} onClick={() => setResuming(true)}>
              <History size={18} aria-hidden />Retomar pendientes de días anteriores
            </Button>
          ) : null}

          {list.length ? (
            <div className={styles.desktopOnly}>
              <h2 className={styles.heading}>Locales · en orden</h2>
              <Table label="Locales de la jornada">
                <thead>
                  <tr><th>#</th><th>Comercio</th><th>Origen</th><th>Tarea</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {list.map((v) => (
                    <tr key={v.id}>
                      <td className={styles.muted}>{stop(v)}</td>
                      <td>
                        <Link to="/visit/$visitId" params={{ visitId: v.id }} className={styles.cellLink}>
                          <span className={styles.strong}>{v.store.name ?? v.store.address}</span>
                          <span className={styles.help}>{v.store.name ? v.store.address : v.store.area ?? ''}</span>
                        </Link>
                      </td>
                      <td className={styles.small}>{v.addedByMe ? 'Vos' : v.addedByName ?? '—'}</td>
                      <td className={styles.small}>{v.task ?? '—'}</td>
                      <td><StatusChip work={v.workStatus} review={v.reviewStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : null}
        </section>

        {next ? (
          <aside className={styles.desktopAside}>
            <span className={styles.eyebrow}>Siguiente</span>
            <NextCard visit={next} stop={stop(next)} />
          </aside>
        ) : null}
      </div>

      <div className={styles.fab}>
        <Button size="md" className={styles.fabButton} onClick={() => setAdding(true)}>
          <Plus size={20} aria-hidden />Agregar dirección
        </Button>
      </div>

      <AddAddressSheet open={adding} onClose={() => setAdding(false)} ctx={ctx} workdayId={workday.id} date={workday.workDate} />
      <ResumeSheet
        open={resuming}
        onClose={() => setResuming(false)}
        ctx={ctx}
        date={workday.workDate}
        workdayId={workday.id}
        visits={resumable.data ?? []}
        onDone={() => setResuming(false)}
      />
    </>
  )
}

function NextCard({ visit: v, stop }: { visit: Visit; stop: number }) {
  const displays = v.displays.length
  return (
    <div className={styles.next}>
      <div className={styles.nextHead}>
        <span className={styles.nextStop}>Parada {stop}</span>
        <span className={styles.nextChip}><span className={styles.nextDot} />{v.workStatus === 'in_progress' ? 'En curso' : 'Pendiente'}</span>
      </div>
      <div className={styles.nextTitles}>
        <span className={styles.nextName}>{v.store.name ?? v.store.address}</span>
        <span className={styles.nextSoft}>
          {[v.store.name ? v.store.address : null, v.store.area, v.store.customerNumber && `Cliente ${v.store.customerNumber}`].filter(Boolean).join(' · ')}
        </span>
      </div>
      <span className={styles.nextMeta}>
        {[v.task, displays ? `${displays} ${displays === 1 ? 'exhibición' : 'exhibiciones'}` : null, originLabel(v)].filter(Boolean).join(' · ')}
      </span>
      <Link to="/visit/$visitId" params={{ visitId: v.id }} className={styles.nextButton}>
        {v.workStatus === 'pending' ? <><Camera size={20} aria-hidden />Marcar llegada</> : 'Seguir con la visita'}
      </Link>
    </div>
  )
}

const NUMBER_TONE: Record<WorkStatus, string | undefined> = {
  pending: undefined,
  in_progress: styles.numActive,
  done: styles.numDone,
  refused: styles.numRefused,
  closed: styles.numClosed,
}

function StopRows({ visits, stop }: { visits: Visit[]; stop: (v: Visit) => number }) {
  return (
    <ul className={styles.rows}>
      {visits.map((v) => (
        <li key={v.id}>
          <Link to="/visit/$visitId" params={{ visitId: v.id }} className={styles.row}>
            <span className={clsx(styles.num, NUMBER_TONE[v.workStatus])}>{stop(v)}</span>
            <span className={styles.rowText}>
              <span className={styles.rowName}>{v.store.name ?? v.store.address}</span>
              <span className={styles.rowLead}>{subline(v)}</span>
            </span>
            <StatusChip work={v.workStatus} review={v.reviewStatus} />
          </Link>
        </li>
      ))}
    </ul>
  )
}
