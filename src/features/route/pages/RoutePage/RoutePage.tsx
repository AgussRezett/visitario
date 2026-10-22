import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { formatLongDate, todayInArgentina } from '@/domain/dates'
import { applyRouteOrder, approximateRoute, inRoute, lineFromFirstStop, type Point, type Stop } from '@/domain/route'
import { Banner } from '@/ui/Banner'
import { useWorkContext } from '@/features/workday/context'
import { workdayQuery, type Visit } from '@/features/workday/api/queries'
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
    const origin: Point | undefined = options.origin ?? undefined
    // Without my location the trip starts at a store: the chosen one, or the first of the day.
    const has = (id: string) => stops.some((s) => s.id === id)
    const firstId = has(options.firstId) ? options.firstId : origin ? undefined : stops[0]?.id
    const last = has(lastId) && lastId !== firstId ? lastId : undefined
    const straight = approximateRoute({ stops, origin, firstId, lastId: last })
    setPlan({ key, ids: straight.ids, km: straight.km, minutes: null, byStreet: false, line: null })
    setStep('result')
    setBusy(true)
    const byStreet = await streetRoute({ stops, origin, firstId, lastId: last, mode: options.mode })
    setBusy(false)
    const final = byStreet ? { ids: byStreet.ids, km: byStreet.km, minutes: byStreet.minutes, byStreet: true, line: byStreet.line } : { ...straight, minutes: null, byStreet: false, line: null }
    if (byStreet) setPlan({ key, ...final })
    // Kept for the day, without the stretch from the phone: where the person was is never saved.
    const first = stops.find((s) => s.id === final.ids[0])
    const line = final.line?.length && first ? (origin ? lineFromFirstStop(final.line, first.location) : final.line) : null
    save.mutate({ ...final, line, mode: options.mode, fromOrigin: Boolean(origin) })
  }

  const apply = async () => {
    if (!shown || !day) return
    const byId = new Map(day.map((v) => [v.id, v]))
    for (const move of applyRouteOrder(day, shown.ids)) {
      const v = byId.get(move.id)
      if (v) await visitChanges(v).patch({ sort_order: move.sortOrder })
    }
    await navigate({ to: '/s/workday', search: date === todayInArgentina() ? {} : { date } })
  }

  if (!ctx) return null
  const head = (
    <div className={styles.titles}>
      <span className={styles.eyebrow}>{formatLongDate(date)}{todo.length ? ` · ${todo.length} ${todo.length === 1 ? 'local' : 'locales'}` : ''}</span>
      <h1 className={styles.title}>Recorrido</h1>
    </div>
  )

  let body
  if (workday.isError || visits.isError) body = <Banner tone="error">No pudimos cargar tu jornada. Revisá la conexión y recargá.</Banner>
  else if (workday.isPending || (workday.data && !day)) body = <DaySkeleton />
  else if (!workday.data) body = <Banner tone="info" title="Hoy todavía no hay recorrido">Cuando abras la jornada y cargues los locales, acá vas a poder ordenarlos.</Banner>
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
      <div className={styles.top} data-step={view}>{head}</div>
      {body}
    </div>
  )
}
