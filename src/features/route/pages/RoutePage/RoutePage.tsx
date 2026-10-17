import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { formatLongDate, todayInArgentina } from '@/domain/dates'
import { applyRouteOrder, approximateRoute, inRoute, type Point, type Stop } from '@/domain/route'
import { Banner } from '@/ui/Banner'
import { useIsDesktop } from '@/lib/useMedia'
import { useWorkContext } from '@/features/workday/context'
import { visitsQuery, workdayQuery, type Visit } from '@/features/workday/api/queries'
import { useVisitList } from '@/features/sync/hooks'
import { visitChanges } from '@/features/sync/changes'
import { DaySkeleton } from '@/features/workday/components/Skeletons'
import { streetRoute } from '../../api'
import { RouteSetup, type RouteOptions } from './RouteSetup'
import { RouteResult, type RoutePlan } from './RouteResult'
import styles from './RoutePage.module.scss'

const located = (v: Visit) => v.store.lat !== null && v.store.lng !== null
const toStop = (v: Visit): Stop => ({ id: v.id, location: { lat: v.store.lat as number, lng: v.store.lng as number } })

/** The best order for the stores that are left (wireframes A07, A08, AD08). */
export function RoutePage({ date: requested }: { date?: string }) {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const desktop = useIsDesktop()
  const date = requested ?? todayInArgentina()
  const companyId = ctx?.companyId ?? ''
  const personId = ctx?.personId ?? ''
  const workday = useQuery({ ...workdayQuery(companyId, personId, date), enabled: Boolean(ctx) })
  const visits = useQuery({ ...visitsQuery(workday.data?.id ?? '', personId), enabled: Boolean(workday.data) })
  const day = useVisitList(visits.data)

  const todo = useMemo(() => (day ?? []).filter(inRoute), [day])
  const missing = todo.filter((v) => !located(v))
  const [options, setOptions] = useState<RouteOptions>({ mode: 'driving', origin: null, firstId: 'auto', lastId: null, left: [] })
  const candidates = todo.filter(located)
  const selected = candidates.filter((v) => !options.left.includes(v.id))
  // A store closed earlier goes last by default: the merchandiser comes back later.
  const lastId = options.lastId ?? selected.find((v) => v.workStatus === 'closed')?.id ?? 'auto'
  const [plan, setPlan] = useState<(RoutePlan & { key: string }) | null>(null)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<'setup' | 'result'>('setup')

  const key = JSON.stringify([options.mode, options.origin, options.firstId, lastId, selected.map((v) => v.id)])
  const current = plan?.key === key ? plan : null

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
    if (byStreet) setPlan({ key, ids: byStreet.ids, km: byStreet.km, minutes: byStreet.minutes, byStreet: true, line: byStreet.line })
  }

  const apply = async () => {
    if (!current || !day) return
    const byId = new Map(day.map((v) => [v.id, v]))
    for (const move of applyRouteOrder(day, current.ids)) {
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
  else if (!todo.length) body = <Banner tone="ok" title="No quedan locales por visitar">Los de esta jornada ya están terminados, aprobados o no autorizaron la visita.</Banner>
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
        plan={current}
        visits={todo}
        mode={options.mode}
        origin={options.origin}
        lastId={lastId}
        perLeg={desktop ? 10 : 4}
        refining={busy}
        onBack={() => setStep('setup')}
        onRecalculate={() => void calculate()}
        onApply={() => void apply()}
      />
    )
    body = (
      <div className={styles.columns} data-step={current ? step : 'setup'}>
        <div className={styles.setup}>{setup}</div>
        <div className={styles.result}>{result}</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.top} data-step={current ? step : 'setup'}>{head}</div>
      {body}
    </div>
  )
}
