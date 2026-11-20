import { lazy, Suspense, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Route as RouteIcon } from 'lucide-react'
import { addDays, formatLongDate, todayInArgentina } from '@/domain/dates'
import { chooseStops, eligible, unlocated, type PlanGoal } from '@/domain/route-plan'
import type { UnderstoodPlan } from '@/domain/plan-request'
import { areasOf } from '@/domain/store-map'
import type { TravelMode } from '@/domain/route'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { useWide } from '@/lib/use-wide'
import { Field } from '@/ui/Field'
import { Skeleton } from '@/ui/Skeleton'
import { useCatalogs } from '@/features/workday/api/queries'
import { useWorkContext } from '@/features/workday/context'
import { storeMapQuery } from '@/features/storemap/api'
import { teamDayQuery } from '@/features/team/api/queries'
import { pendingQuery, toCandidates, useAddRoute } from '@/features/routeplan/api'
import { orderStops, type PlannedRoute } from '@/features/routeplan/order'
import { PlanSetup, type SetupFilters } from './PlanSetup'
import { ZoneControls } from './ZoneControls'
import { PlanResult } from './PlanResult'
import { AiRequest } from './AiRequest'
import styles from './PlanRoutePage.module.scss'
import { LocalBoundary } from '@/features/errors/components/LocalBoundary'

const PlanMap = lazy(() => import('@/features/routeplan/components/PlanMap/PlanMap'))

export interface PlanSearch {
  date?: string
  person?: string
}

const SETUP: SetupFilters = { areas: [], sellerIds: [], channelIds: [], displayTypeIds: [], minRapport: null, staleDays: null, includePlanned: false }

/** Armar recorrido: a goal and filters, the stores that serve it best close together, into a day. */
export function PlanRoutePage({ date: wanted, person }: PlanSearch) {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const today = todayInArgentina()
  const date = wanted ?? addDays(today, 1)
  const companyId = ctx?.companyId ?? ''
  const on = Boolean(ctx)
  const points = useQuery({ ...storeMapQuery(companyId), enabled: on })
  const pending = useQuery({ ...pendingQuery(companyId, date), enabled: on })
  const team = useQuery({ ...teamDayQuery(companyId, date), enabled: on })
  const catalogs = useCatalogs(companyId).data
  const addRoute = useAddRoute(companyId)

  const [goal, setGoal] = useState<PlanGoal>('overdue')
  const [filters, setFilters] = useState<SetupFilters>(SETUP)
  const [count, setCount] = useState(12)
  const [mode, setMode] = useState<TravelMode>('walking')
  /** A zone marked on the map (its corners), or null for anywhere; while drawing, taps add corners. */
  const [zone, setZone] = useState<[number, number][] | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [personId, setPersonId] = useState(person ?? '')
  const [plan, setPlan] = useState<PlannedRoute | null>(null)
  const [busy, setBusy] = useState(false)
  const [added, setAdded] = useState<string | null>(null)
  /** When fewer stores fit than were asked for: how many were asked, and how many fit but are not on the map. */
  const [short, setShort] = useState<{ asked: number; unlocated: number } | null>(null)

  const sellers = useMemo(() => [...(catalogs?.sellers ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es')).map((s) => ({ id: s.id, name: s.name, personId: s.personId })), [catalogs])
  const channels = useMemo(() => (catalogs?.channels ?? []).map((c) => ({ id: c.id, name: c.name })), [catalogs])
  const displayTypes = useMemo(() => (catalogs?.displayTypes ?? []).map((t) => ({ id: t.id, name: t.name })), [catalogs])
  // It applies as soon as it has 3 corners: no name and nothing to save first.
  const ring = zone && zone.length >= 3 ? zone : null
  const cands = useMemo(() => toCandidates(points.data ?? [], pending.data ?? new Map()), [points.data, pending.data])
  const wide = useWide()
  const fit = useMemo(() => eligible(cands, { ...filters, zone: ring }, today), [cands, filters, ring, today])
  if (!ctx) return null
  if (ctx.role !== 'supervisor' && ctx.role !== 'admin') return <Banner tone="info">Armar recorridos es para supervisores y administradores.</Banner>

  const changed = () => {
    setPlan(null)
    setAdded(null)
  }
  const build = async (stops = chooseStops(fit, goal, count, today), fresh = true) => {
    setDrawing(false)
    setBusy(true)
    setAdded(null)
    if (fresh) setShort(stops.length < count ? { asked: count, unlocated: unlocated(cands, { ...filters, zone: ring }, today) } : null)
    try {
      setPlan(stops.length ? await orderStops(stops, mode) : null)
    } finally {
      setBusy(false)
    }
  }
  // A written request fills in the form, as a whole: what it does not say goes back to all.
  const apply = (u: UnderstoodPlan) => {
    changed()
    if (u.goal) setGoal(u.goal)
    setFilters({ ...SETUP, sellerIds: u.sellerIds, channelIds: u.channelIds, areas: u.areas, minRapport: u.minRapport, staleDays: u.staleDays })
    setZone(null)
    setDrawing(false)
    if (u.count) setCount(u.count)
    if (u.mode) setMode(u.mode)
    if (u.personId) setPersonId(u.personId)
    if (u.date && u.date !== date) void navigate({ to: '/s/plan', search: { date: u.date, person: u.personId ?? (personId || undefined) } })
  }
  const areas = areasOf(points.data ?? [])
  const dayLabel = formatLongDate(date).toLowerCase()
  const add = async () => {
    if (!plan) return
    const n = await addRoute.mutateAsync({ merchandiserId: personId, date, storeIds: plan.stops.map((s) => s.id) })
    const who = team.data?.find((m) => m.personId === personId)?.firstName ?? ''
    setAdded(n === plan.stops.length ? `Listo: ${n} locales en la jornada de ${who}.` : `Agregamos ${n} locales a la jornada de ${who}; ${plan.stops.length - n} ya estaban.`)
  }

  const map = (
    <>
      {points.isPending ? <Skeleton height={360} /> : points.error ? <Banner tone="error">No pudimos cargar los locales. Revisá la conexión.</Banner> : (
        <LocalBoundary what="el mapa"><Suspense fallback={<Skeleton height={360} />}>
          <PlanMap candidates={fit} stops={(plan?.stops ?? []).map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, label: s.address }))} line={plan?.line ?? null}
            zone={zone && zone.length ? zone : null} drawing={drawing} onDrawPoint={(p) => { changed(); setZone((z) => [...(z ?? []), p]) }}
            frameKey={JSON.stringify([plan?.stops.map((s) => s.id), drawing, points.data?.length])} />
        </Suspense></LocalBoundary>
      )}
    </>
  )

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <span className={styles.eyebrow}>Asignar</span>
        <h1 className={styles.title}>Armar recorrido</h1>
        <p className={styles.lead}>Elegí un objetivo y Visitario arma el recorrido con los locales que mejor lo cumplen, cerca entre sí.</p>
      </header>

      <div className={styles.layout}>
        <section className={styles.setup} aria-label="Qué recorrido armar">
          <Field label="Día" type="date" value={date} onChange={(e) => { if (e.target.value) { changed(); void navigate({ to: '/s/plan', search: { date: e.target.value, person: personId || undefined } }) } }} />
          <AiRequest companyId={companyId} today={today} onApply={apply}
            catalog={{ sellers, channels, zones: [], areas, people: team.data ?? [] }} />
          <ZoneControls
            zone={zone} drawing={drawing} inside={ring ? fit.length : null}
            onDraw={() => { changed(); setZone([]); setDrawing(true) }}
            onUndo={() => { changed(); setZone((z) => (z ? z.slice(0, -1) : z)) }}
            onDone={() => setDrawing(false)}
            onClear={() => { changed(); setZone(null); setDrawing(false) }}
          />
          {/* On a phone the map goes right under the zone, so drawing it is in reach. */}
          {wide ? null : map}
          <PlanSetup
            goal={goal} onGoal={(g) => { changed(); setGoal(g) }} filters={filters} onFilters={(p) => { changed(); setFilters((f) => ({ ...f, ...p })) }}
            count={count} onCount={(n) => { changed(); setCount(n) }} mode={mode} onMode={(m) => { changed(); setMode(m) }}
            sellers={sellers} channels={channels} areas={areas} displayTypes={displayTypes}
          />
          <p className={styles.fit} role="status">{points.data ? `${fit.length} ${fit.length === 1 ? 'local cumple' : 'locales cumplen'} los filtros` : ''}</p>
          <Button size="lg" onClick={() => void build()} disabled={fit.length < 2 || (drawing && !ring)} loading={busy} className={styles.build}>
            <RouteIcon size={20} aria-hidden />Armar recorrido
          </Button>
        </section>

        <div className={styles.side}>
          {wide ? map : null}
          {plan ? (
            <PlanResult plan={plan} today={today} onRemove={(id) => void build(plan.stops.filter((s) => s.id !== id), false)} short={short}
              people={team.data ?? []} personId={personId} onPerson={setPersonId} dayLabel={dayLabel}
              onAdd={() => void add().catch(() => undefined)} adding={addRoute.isPending} added={added} error={addRoute.error?.message ?? null} />
          ) : !busy && fit.length < 2 && points.data ? (
            <Banner tone="info">Con estos filtros no hay locales para armar un recorrido. Probá con menos filtros u otra zona.</Banner>
          ) : null}
          {added ? <Button variant="secondary" size="md" onClick={() => void navigate({ to: '/s/assign', search: { date } })}>Ir a Asignar</Button> : null}
        </div>
      </div>
    </div>
  )
}
