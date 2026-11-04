import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { formatLongDate, todayInArgentina } from '@/domain/dates'
import { applyRouteOrder, approximateRoute, inRoute, lineFromFirstStop, routeKm, type Point, type Stop, type TravelMode } from '@/domain/route'
import { Banner } from '@/ui/Banner'
import { useWorkContext } from '@/features/workday/context'
import { historyQuery, workdayQuery, type Visit } from '@/features/workday/api/queries'
import { WeekStrip } from '@/features/workday/components/WeekStrip'
import { useVisitList } from '@/features/sync/hooks'
import { visitChanges } from '@/features/sync/changes'
import { DaySkeleton } from '@/features/workday/components/Skeletons'
import { savedRouteQuery, streetRoute, useSaveRoute } from '../../api'
import { RouteSetup, type RouteOptions } from './RouteSetup'
import { RouteResult, type RoutePlan } from './RouteResult'
import { useOperationDay } from '@/features/operation/useOperationDay'
import styles from './RoutePage.module.scss'

const located = (v: Visit) => v.store.lat !== null && v.store.lng !== null
const toStop = (v: Visit): Stop => ({ id: v.id, location: { lat: v.store.lat as number, lng: v.store.lng as number } })

/** The best order for the stores that are left (wireframes A07, A08, AD08). */
export function RoutePage({ date: requested }: { date?: string }) {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const date = requested ?? todayInArgentina()
  const companyId = ctx?.companyId ?? ''
  const personId = ctx?.personId ?? ''
  const workday = useQuery({ ...workdayQuery(companyId, personId, date), enabled: Boolean(ctx) })
  const history = useQuery({ ...historyQuery(companyId, personId), enabled: Boolean(ctx) })
  const isToday = date === todayInArgentina()
  // With an operativo, its stops are on my route too.
  const visits = useOperationDay(companyId, personId, workday.data, date)
  const day = useVisitList(visits.visits)

  const todo = useMemo(() => (day ?? []).filter(inRoute), [day])
  const missing = todo.filter((v) => !located(v))
  const [options, setOptions] = useState<RouteOptions>({ mode: 'driving', origin: null, firstId: 'auto', lastId: null, left: [] })
  const candidates = todo.filter(located)
  const selected = candidates.filter((v) => !options.left.includes(v.id))
  // A store closed earlier goes last by default: the merchandiser comes back later.
  const lastId = options.lastId ?? selected.find((v) => v.workStatus === 'closed')?.id ?? 'auto'
  const [plan, setPlan] = useState<(RoutePlan & { key: string }) | null>(null)
  const [busy, setBusy] = useState(false)
  /** Unset until the person moves: then a route kept from before opens on the result. */
  const [step, setStep] = useState<'setup' | 'result' | null>(null)
  const workdayId = workday.data?.id ?? ''
  const saved = useQuery({ ...savedRouteQuery(workdayId), enabled: Boolean(workdayId) })
  const save = useSaveRoute(workdayId)
  // The last street request wins: a newer drag or a new calculation drops older answers.
  const request = useRef(0)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  /** Kept for the day, without the stretch from the phone: where the person was is never saved. */
  const keep = (final: Omit<RoutePlan, 'custom'>, stops: Stop[], origin: Point | undefined, mode: TravelMode, custom: boolean) => {
    const first = stops.find((s) => s.id === final.ids.find((id) => stops.some((x) => x.id === id)))
    const line = final.line?.length && first ? (origin ? lineFromFirstStop(final.line, first.location) : final.line) : null
    save.mutate({ ...final, line, mode, fromOrigin: Boolean(origin), custom })
  }

  // Coming back to a route kept from before: recalculating starts from how it was made.
  const savedMode = saved.data?.mode
  useEffect(() => {
    if (savedMode) setOptions((o) => ({ ...o, mode: savedMode }))
  }, [savedMode])

  const key = JSON.stringify([options.mode, options.origin, options.firstId, lastId, selected.map((v) => v.id)])
  const current = plan?.key === key ? plan : null
  // What shows: the route just calculated, or the last one kept for the day.
  const kept = !current && saved.data ? saved.data : null
  const shown = current ?? kept
  const view = shown ? (step ?? 'result') : 'setup'

  const calculate = async () => {
    const stops = selected.map(toStop)
    if (!stops.length) return
    window.clearTimeout(timer.current)
    const n = ++request.current
    const origin: Point | undefined = options.origin ?? undefined
    // Without my location the trip starts at a store: the chosen one, or the first of the day.
    const has = (id: string) => stops.some((s) => s.id === id)
    const firstId = has(options.firstId) ? options.firstId : origin ? undefined : stops[0]?.id
    const last = has(lastId) && lastId !== firstId ? lastId : undefined
    const straight = approximateRoute({ stops, origin, firstId, lastId: last })
    setPlan({ key, ids: straight.ids, km: straight.km, minutes: null, byStreet: false, line: null, custom: false })
    setStep('result')
    setBusy(true)
    const byStreet = await streetRoute({ stops, origin, firstId, lastId: last, mode: options.mode })
    if (n !== request.current) return
    setBusy(false)
    const final = byStreet ? { ids: byStreet.ids, km: byStreet.km, minutes: byStreet.minutes, byStreet: true, line: byStreet.line } : { ...straight, minutes: null, byStreet: false, line: null }
    if (byStreet) setPlan({ key, ...final, custom: false })
    keep(final, stops, origin, options.mode, false)
  }

  /** Ordered by hand: straight lines at once, then that same order by streets, and kept. */
  const reorder = (ids: string[]) => {
    if (!day) return
    const byId = new Map(day.map((v) => [v.id, v]))
    const stops = ids.flatMap((id) => {
      const v = byId.get(id)
      return v && located(v) ? [toStop(v)] : []
    })
    const origin = kept ? undefined : options.origin ?? undefined
    const mode = kept ? kept.mode : options.mode
    setPlan({ key, ids, km: routeKm(stops, origin), minutes: null, byStreet: false, line: null, custom: true })
    setStep('result')
    setBusy(true)
    const n = ++request.current
    window.clearTimeout(timer.current)
    // A moment after the last move, so dragging over several places asks only once.
    timer.current = window.setTimeout(() => {
      void streetRoute({ stops, origin, mode, fixed: true }).then((byStreet) => {
        if (n !== request.current) return
        setBusy(false)
        const final = byStreet ? { ids, km: byStreet.km, minutes: byStreet.minutes, byStreet: true, line: byStreet.line } : { ids, km: routeKm(stops, origin), minutes: null, byStreet: false, line: null }
        if (byStreet) setPlan({ key, ...final, custom: true })
        keep(final, stops, origin, mode, true)
      })
    }, 700)
  }

  const apply = async () => {
    if (!shown || !day) return
    const byId = new Map(day.map((v) => [v.id, v]))
    for (const move of applyRouteOrder(day, shown.ids)) {
      const v = byId.get(move.id)
      if (v) await visitChanges(v).patch({ sort_order: move.sortOrder })
    }
    await navigate({ to: '/s/workday', search: isToday ? {} : { date } })
  }

  if (!ctx) return null
  const head = (
    <div className={styles.titles}>
      <span className={styles.eyebrow}>{formatLongDate(date)}{todo.length ? ` · ${todo.length} ${todo.length === 1 ? 'local' : 'locales'}` : ''}</span>
      <h1 className={styles.title}>Recorrido</h1>
    </div>
  )
  // Any day of the week: tomorrow's route can be planned the night before.
  const week = (
    <div className={styles.week}>
      <WeekStrip date={date} days={history.data ?? []} onSelect={(d) => void navigate({ to: '/s/route', search: d === todayInArgentina() ? {} : { date: d } })} />
    </div>
  )

  let body
  if (workday.isError || visits.isError) body = <Banner tone="error">No pudimos cargar tu jornada. Revisá la conexión y recargá.</Banner>
  else if (workday.isPending || (workday.data && !day)) body = <DaySkeleton />
  else if (!workday.data) body = <Banner tone="info" title={isToday ? 'Hoy todavía no hay recorrido' : 'Ese día todavía no tiene jornada'}>{isToday ? 'Cuando abras la jornada y cargues los locales, acá vas a poder ordenarlos.' : 'Cuando tu supervisor te asigne locales para ese día, acá vas a poder ordenarlos.'}</Banner>
  else if (!todo.length && !kept) body = <Banner tone="ok" title="No quedan locales por visitar">Los de esta jornada ya están terminados, aprobados o no autorizaron la visita.</Banner>
  else {
    const setup = (
      <RouteSetup
        options={{ ...options, lastId }}
        onChange={(next) => setOptions((o) => ({ ...o, ...next }))}
        candidates={candidates}
        selected={selected}
        missing={missing}
        busy={busy}
        onCalculate={() => void calculate()}
      />
    )
    const result = (
      <RouteResult
        plan={shown}
        visits={day ?? []}
        mode={kept ? kept.mode : options.mode}
        origin={kept ? null : options.origin}
        fromOrigin={kept ? kept.fromOrigin : Boolean(options.origin)}
        lastId={lastId}
        refining={busy}
        savedAt={kept?.savedAt ?? null}
        canRecalculate={todo.length > 0}
        onBack={() => setStep('setup')}
        onRecalculate={() => void calculate()}
        onApply={() => void apply()}
        onReorder={reorder}
      />
    )
    body = (
      <div className={styles.columns} data-step={view}>
        <div className={styles.setup}>{setup}</div>
        <div className={styles.result}>{result}</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.top} data-step={view}>{head}{week}</div>
      {body}
    </div>
  )
}
