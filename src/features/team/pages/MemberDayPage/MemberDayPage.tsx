import { Suspense, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, CalendarPlus, ChevronLeft, ChevronRight, Eye, Map as MapIcon, Users } from 'lucide-react'
import { addDays, formatLongDate, todayInArgentina } from '@/domain/dates'
import { lastActivityText } from '@/domain/team'
import { workdayProgress } from '@/domain/visit'
import { PersonAvatar } from '@/features/people/PersonAvatar'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Refreshing } from '@/ui/Refreshing'
import { Skeleton } from '@/ui/Skeleton'
import { useWorkContext } from '@/features/workday/context'
import type { Workday } from '@/features/workday/api/queries'
import { memberWorkdayQuery, teamDayQuery } from '@/features/team/api/queries'
import { useOperationDay } from '@/features/operation/useOperationDay'
import { RouteSketch } from '@/features/route/pages/RoutePage/RouteSketch'
import { StreetMap } from '@/features/route/pages/RoutePage/StreetMap'
import { MemberStops, type MemberFilter } from './MemberStops'
import styles from './MemberDayPage.module.scss'

/**
 * An activador's day as their supervisor sees it: read-only, in the activador's own order,
 * with what is done, where they are and what comes next, on the map too.
 */
export function MemberDayPage({ personId, date: requested }: { personId: string; date?: string }) {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const today = todayInArgentina()
  const date = requested ?? today
  const companyId = ctx?.companyId ?? ''
  const on = Boolean(ctx)
  const team = useQuery({ ...teamDayQuery(companyId, date), enabled: on, placeholderData: keepPreviousData })
  const workday = useQuery({ ...memberWorkdayQuery(companyId, personId, date), enabled: on, placeholderData: keepPreviousData })
  if (!ctx) return null

  const member = team.data?.find((m) => m.personId === personId)
  const first = member?.firstName ?? 'El activador'
  const goTo = (d: string) => navigate({ to: '/s/today/$personId', params: { personId }, search: d === today ? {} : { date: d } })
  const back = date === today ? {} : { date }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <Link to="/s/today" search={back} className={styles.back}><ArrowLeft size={18} aria-hidden />Hoy en el equipo</Link>
        <div className={styles.titles}>
          {member ? <PersonAvatar personId={personId} firstName={member.firstName} lastName={member.lastName} size={48} /> : null}
          <div>
            <span className={styles.eyebrow}><Eye size={14} aria-hidden />{formatLongDate(date)} · solo vista</span>
            <h1 className={styles.title}>{member ? `Jornada de ${member.firstName} ${member.lastName}` : team.isPending ? 'Jornada' : 'Jornada del activador'}</h1>
          </div>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={() => goTo(addDays(date, -1))} aria-label="Día anterior"><ChevronLeft size={18} aria-hidden />Anterior</Button>
          {date !== today ? <Button variant="secondary" size="sm" onClick={() => goTo(today)}>Hoy</Button> : null}
          <Button variant="secondary" size="sm" onClick={() => goTo(addDays(date, 1))} aria-label="Día siguiente">Siguiente<ChevronRight size={18} aria-hidden /></Button>
        </div>
      </header>

      {team.isError || workday.isError ? <Banner tone="error">No pudimos cargar la jornada. Revisá la conexión.</Banner> : null}

      {workday.isPending || team.isPending ? (
        <div className={styles.skeletons}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={72} />)}</div>
      ) : !member && !workday.data ? (
        <p className={styles.empty}>Esta persona no está en tu equipo o no trabaja ese día.</p>
      ) : !workday.data ? (
        <section className={styles.none}>
          <p className={styles.noneText}>{first} no tiene jornada {date === today ? 'hoy' : 'ese día'}.</p>
          <Link to="/s/assign" search={{ date }} className={styles.assign}><CalendarPlus size={18} aria-hidden />Armarle la jornada</Link>
        </section>
      ) : (
        <Refreshing active={workday.isPlaceholderData || team.isPlaceholderData}>
          <MemberDay companyId={companyId} personId={personId} workday={workday.data} first={first}
            activity={member ? lastActivityText(member.lastActivityAt, new Date()) + (member.lastActivityAt && member.lastPlace ? ` · ${member.lastPlace}` : '') : null} />
        </Refreshing>
      )}
    </div>
  )
}

interface MemberDayProps {
  companyId: string
  personId: string
  workday: Workday
  first: string
  activity: string | null
}

/** The day itself, once there is one: progress, the stops in order and the map. */
function MemberDay({ companyId, personId, workday, first, activity }: MemberDayProps) {
  const day = useOperationDay(companyId, personId, workday, workday.workDate)
  const [filter, setFilter] = useState<MemberFilter>('all')
  // The map is heavy: open on a computer, one tap away on a phone.
  const [mapOpen, setMapOpen] = useState(() => window.matchMedia('(min-width: 1024px)').matches)
  if (day.isPending) return <div className={styles.skeletons}>{[0, 1, 2].map((i) => <Skeleton key={i} height={72} />)}</div>
  if (day.isError) return <Banner tone="error">No pudimos cargar los locales. Revisá la conexión.</Banner>

  const stops = day.visits ?? []
  const progress = workdayProgress(stops)
  const located = stops.filter((v) => v.store.lat !== null && v.store.lng !== null)

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <div className={styles.summary}>
          <span className={styles.figure}><b>{progress.visited}</b> de {progress.total} con resultado</span>
          {workday.status === 'draft' ? <span className={styles.draft}>Sin publicar: {first} todavía no la ve</span> : null}
          {day.op ? <span className={styles.op}><Users size={14} aria-hidden />En un operativo</span> : null}
          {activity ? <span className={styles.activity}>{activity}</span> : null}
        </div>
        {stops.length ? (
          <MemberStops stops={stops} filter={filter} onFilter={setFilter} member={first} operationStops={day.operationStops} />
        ) : (
          <p className={styles.empty}>La jornada de {first} está abierta y todavía no tiene locales.</p>
        )}
      </div>

      {stops.length ? (
        <aside className={styles.aside} aria-label="Recorrido en el mapa">
          <div className={styles.mapHead}>
            <h2 className={styles.mapTitle}>Su recorrido</h2>
            <Button variant="secondary" size="sm" className={styles.mapToggle} onClick={() => setMapOpen((o) => !o)} aria-expanded={mapOpen}>
              <MapIcon size={16} aria-hidden />{mapOpen ? 'Ocultar mapa' : 'Ver en el mapa'}
            </Button>
          </div>
          {mapOpen ? (
            located.length ? (
              <Suspense fallback={<RouteSketch stops={located} origin={null} />}>
                <StreetMap key={stops.map((v) => `${v.id}:${v.workStatus}`).join(',')} stops={stops} origin={null} line={null} mode="walking" progress />
              </Suspense>
            ) : (
              <p className={styles.empty}>Ningún local de la jornada tiene ubicación todavía.</p>
            )
          ) : null}
          <p className={styles.legend}><span className={styles.dotDone} aria-hidden />Hecho<span className={styles.dotNow} aria-hidden />En curso<span className={styles.dotTodo} aria-hidden />Por hacer</p>
        </aside>
      ) : null}
    </div>
  )
}
