import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ChevronLeft, ChevronRight, CloudOff, Plus } from 'lucide-react'
import { addDays, formatLongDate, formatTime, todayInArgentina } from '@/domain/dates'
import { agoText, lastActivityText, memberAlerts, shiftLabel, shiftPhase, teamTotals, type TeamMember } from '@/domain/team'
import { initials } from '@/lib/format'
import { Avatar } from '@/ui/Avatar'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Refreshing } from '@/ui/Refreshing'
import { Skeleton } from '@/ui/Skeleton'
import { StatusChip } from '@/ui/StatusChip'
import { Table } from '@/ui/Table'
import { useWorkContext } from '@/features/workday/context'
import { reviewQuery, shiftOf, shiftsQuery, teamDayQuery } from '@/features/team/api/queries'
import { DaySegments } from '@/features/team/components/DaySegments'
import { MemberAlerts } from '@/features/team/components/MemberAlerts'
import { sharedRepeats } from '@/domain/operations'
import { useDayOperations } from '@/features/operation/api'
import { OperationsBoard } from '@/features/operation/components/OperationsBoard'
import styles from './TodayPage.module.scss'

/** The team's day: progress per merchandiser, what is waiting for review, and alerts (S01 / SM01). */
export function TodayPage({ date: requested }: { date?: string }) {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const today = todayInArgentina()
  const date = requested ?? today
  const on = Boolean(ctx)
  const team = useQuery({ ...teamDayQuery(ctx?.companyId ?? '', date), enabled: on, placeholderData: keepPreviousData })
  const queue = useQuery({ ...reviewQuery(ctx?.companyId ?? '', ctx?.personId ?? '', 'to_review', today), enabled: on })
  const shifts = useQuery({ ...shiftsQuery(ctx?.companyId ?? ''), enabled: on })
  const ops = useDayOperations(ctx?.companyId ?? '', date, on)
  if (!ctx) return null

  const goTo = (d: string) => navigate({ to: '/s/today', search: d === today ? {} : { date: d } })
  const now = new Date()
  const members = team.data ?? []
  // A visit of an operativo counts in each member's row; the team's sums count it once.
  const repeats = sharedRepeats(ops.data ?? [], members.map((m) => m.personId))
  const raw = teamTotals(members)
  const totals = { ...raw, total: raw.total - repeats.total, visited: raw.visited - repeats.visited, needsFix: raw.needsFix - repeats.needsFix, refused: raw.refused - repeats.refused }
  const shift = (m: TeamMember) => shiftOf(shifts.data, m.personId)
  const alertsOf = (m: TeamMember) => memberAlerts(m, now, shift(m), date)
  /** Activity in words; before the hours start, when they start. */
  const activity = (m: TeamMember) => {
    const s = shift(m)
    if (s && date === today && shiftPhase(s, now) === 'before' && !(m.lastActivityAt && todayInArgentina(new Date(m.lastActivityAt)) === today)) return `Empieza ${shiftLabel(s).split(' a ')[0]}`
    return `${lastActivityText(m.lastActivityAt, now, s)}${m.lastActivityAt && m.lastPlace ? ` · ${m.lastPlace}` : ''}`
  }
  const inactive = members.flatMap((m) => alertsOf(m).filter((a) => a.kind === 'inactive').map((a) => ({ m, a })))
  const waiting = queue.data ?? []

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.titles}>
          <span className={styles.eyebrow}>{formatLongDate(date)}{date === today ? ` · ${formatTime(now.toISOString())}` : ''}</span>
          <h1 className={styles.title}>{date === today ? 'Hoy en el equipo' : 'El equipo ese día'}</h1>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={() => goTo(addDays(date, -1))} aria-label="Día anterior"><ChevronLeft size={18} aria-hidden />Anterior</Button>
          {date !== today ? <Button variant="secondary" size="sm" onClick={() => goTo(today)}>Hoy</Button> : null}
          <Button variant="secondary" size="sm" onClick={() => goTo(addDays(date, 1))} aria-label="Día siguiente">Siguiente<ChevronRight size={18} aria-hidden /></Button>
          <Link to="/s/assign" search={{ date: addDays(today, 1) }} className={styles.primaryLink}><Plus size={18} aria-hidden />Asignar mañana</Link>
        </div>
      </header>

      {team.isError ? <Banner tone="error">No pudimos cargar el día del equipo. Revisá la conexión.</Banner> : null}

      <Refreshing active={team.isPlaceholderData} className={styles.body}>
        <div className={styles.kpis}>
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>Con resultado</span>
            <b className={styles.kpiValue}>{totals.visited}<span className={styles.kpiOf}> / {totals.total}</span></b>
            <DaySegments m={members.reduce((a, m) => ({ total: a.total + m.total, visited: a.visited + m.visited, approved: a.approved + m.approved, needsFix: a.needsFix + m.needsFix, refused: a.refused + m.refused, closed: a.closed + m.closed, inProgress: a.inProgress + m.inProgress }), { total: -repeats.total, visited: -repeats.visited, approved: -repeats.approved, needsFix: -repeats.needsFix, refused: -repeats.refused, closed: -repeats.closed, inProgress: -repeats.inProgress })} />
          </div>
          <Link to="/s/review" className={styles.kpi}>
            <span className={styles.kpiLabel}>Por revisar</span>
            <b className={styles.kpiValue}>{waiting.length}</b>
            <span className={styles.kpiNote}>{waiting[0]?.finishedAt ? `la más vieja, ${agoText(waiting[0].finishedAt, now)}` : 'Nada pendiente'}</span>
          </Link>
          <Link to="/s/review" search={{ tab: 'needs_fix' }} className={styles.kpi}>
            <span className={styles.kpiLabel}>Con corrección</span>
            <b className={styles.kpiValue} data-tone="fix">{totals.needsFix}</b>
            <span className={styles.kpiNote}>esperando al activador</span>
          </Link>
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>No autorizadas</span>
            <b className={styles.kpiValue} data-tone="refused">{totals.refused}</b>
            <span className={styles.kpiNote}>en el día</span>
          </div>
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>Fotos sin subir</span>
            <b className={styles.kpiValue}>{totals.unsyncedPhotos}</b>
            <span className={styles.kpiNote}>{totals.unsyncedPeople ? `${totals.unsyncedPeople} ${totals.unsyncedPeople === 1 ? 'activador' : 'activadores'} con cambios en el celu` : 'Todo subido'}</span>
          </div>
        </div>

        {inactive.map(({ m, a }) => (
          <Banner key={m.personId} tone="warn" icon={<AlertTriangle size={18} aria-hidden />} title={`${m.firstName} · ${a.text.toLowerCase()}`}>
            {[m.lastPlace && `Último local: ${m.lastPlace}`, m.syncPending ? `${m.syncPending} cambios sin subir` : null].filter(Boolean).join(' · ') || 'Le quedan locales por visitar.'}
          </Banner>
        ))}

        <OperationsBoard companyId={ctx.companyId} meId={ctx.personId} ops={ops.data ?? []} />

        <div className={styles.columns}>
          <section className={styles.team} aria-label="Activadores">
            <h2 className={styles.heading}>Activadores</h2>
            {team.isPending ? (
              <div className={styles.skeletons}>{[0, 1, 2].map((i) => <Skeleton key={i} height={64} />)}</div>
            ) : !members.length ? (
              <p className={styles.empty}>Todavía no hay activadores en tu equipo.</p>
            ) : (
              <>
                <Table className={styles.table} label="Activadores del día">
                  <thead><tr><th>Activador</th><th>Avance</th><th>Última actividad</th><th>Sincronización</th><th>Alertas</th></tr></thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.personId}>
                        <td><span className={styles.person}><Avatar name={initials(m.firstName, m.lastName)} size={32} /><span className={styles.strong}>{m.firstName} {m.lastName}</span></span></td>
                        <td>
                          <span className={styles.progress}>
                            <span className={styles.count}>{m.workdayStatus ? `${m.visited} / ${m.total}` : 'Sin jornada'}{m.workdayStatus === 'draft' ? ' · sin publicar' : ''}</span>
                            {m.total ? <DaySegments m={m} /> : null}
                          </span>
                        </td>
                        <td className={styles.small}>{activity(m)}</td>
                        <td><SyncCell m={m} now={now} /></td>
                        <td><MemberAlerts alerts={alertsOf(m).filter((a) => a.kind !== 'unsynced')} className={styles.alerts} /></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <ul className={styles.list}>
                  {members.map((m) => (
                    <li key={m.personId}>
                      <Link to="/s/review" search={{ tab: 'all', date }} className={styles.row}>
                        <Avatar name={initials(m.firstName, m.lastName)} size={36} />
                        <span className={styles.rowBody}>
                          <span className={styles.rowTop}><span className={styles.strong}>{m.firstName} {m.lastName}</span><span className={styles.count}>{m.workdayStatus ? `${m.visited}/${m.total}` : 'Sin jornada'}</span></span>
                          {m.total ? <DaySegments m={m} height={6} /> : null}
                          <span className={styles.small}>{activity(m)}</span>
                          <MemberAlerts alerts={alertsOf(m)} empty="" className={styles.alerts} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className={styles.queue} aria-label="Por revisar">
            <div className={styles.queueHead}><h2 className={styles.heading}>Por revisar</h2><Link to="/s/review" className={styles.more}>Ver todas</Link></div>
            {waiting.length ? (
              <ul className={styles.queueList}>
                {waiting.slice(0, 5).map((v) => (
                  <li key={v.id}>
                    <Link to="/s/review" search={{ visit: v.id }} className={styles.queueRow}>
                      <span className={styles.rowBody}>
                        <span className={styles.strong}>{v.store.name ?? v.store.address}</span>
                        <span className={styles.small}>{v.merchandiserName.split(' ')[0]} · {v.finishedAt ? formatTime(v.finishedAt) : ''}{v.source === 'added' ? ' · extra' : ''}</span>
                      </span>
                      <StatusChip work={v.workStatus} review={v.reviewStatus} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>No hay visitas esperando revisión.</p>
            )}
          </section>
        </div>
      </Refreshing>
    </div>
  )
}

function SyncCell({ m, now }: { m: { syncPending: number; syncPhotos: number; syncFailed: number; syncReportedAt: string | null }; now: Date }) {
  if (!m.syncReportedAt) return <span className={styles.small}>Sin datos</span>
  if (m.syncFailed) return <span className={styles.sync} data-tone="failed"><AlertTriangle size={14} aria-hidden />{m.syncFailed} rechazados</span>
  if (m.syncPending) return <span className={styles.sync} data-tone="pending"><CloudOff size={14} aria-hidden />{m.syncPhotos ? `${m.syncPhotos} fotos` : `${m.syncPending} cambios`} · {agoText(m.syncReportedAt, now)}</span>
  return <span className={styles.sync} data-tone="ok">Al día</span>
}
