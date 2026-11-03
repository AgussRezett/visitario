import { useMemo, useState, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { Download, Lightbulb, TrendingDown, TrendingUp, X } from 'lucide-react'
import { breakdown, brandShare, byPerson, coverage, daily, EMPTY_FACTS, filterFacts, heat, NO_FILTER, summarize, type Filter } from '@/domain/analytics'
import { project, trend } from '@/domain/forecast'
import { insights } from '@/domain/insights'
import { previousRange, rangeLabel, type Range } from '@/domain/report-period'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Refreshing } from '@/ui/Refreshing'
import { Select } from '@/ui/Select'
import { Skeleton } from '@/ui/Skeleton'
import { useCatalogs } from '@/features/workday/api/queries'
import { reportFactsQuery } from '@/features/team/api/report-facts'
import { PanelCard } from '../PanelCard'
import { KpiTiles } from '../KpiTiles'
import { DailyChart } from '../DailyChart'
import { PeopleRanking } from '../PeopleRanking'
import { SliceBars } from '../SliceBars'
import { Heatmap } from '../Heatmap'
import { WorkCard } from '../WorkCard'
import { CoverageCard } from '../CoverageCard'
import { RapportCard } from '../RapportCard'
import { kpisOf } from './kpis'
import { downloadCsv } from './csv'
import { num, signed } from '../format'
import styles from './AnalyticsPanel.module.scss'

interface Props {
  companyId: string
  range: Range
  today: string
  compare: boolean
  /** The period controls, drawn by the page above. */
  controls: ReactNode
}

/** The reports panel: the period in figures, trends, people, places, work and estimates. */
export function AnalyticsPanel({ companyId, range, today, compare, controls }: Props) {
  const prevRange = previousRange(range)
  const facts = useQuery({ ...reportFactsQuery(companyId, range), placeholderData: keepPreviousData })
  const prevFacts = useQuery({ ...reportFactsQuery(companyId, prevRange), enabled: compare, placeholderData: keepPreviousData })
  const catalogs = useCatalogs(companyId).data
  const here = useRouterState({ select: (r) => r.location.href })
  const [filter, setFilter] = useState<Filter>(NO_FILTER)

  const all = facts.data ?? EMPTY_FACTS
  const f = useMemo(() => filterFacts(all, filter), [all, filter])
  const fp = useMemo(() => (compare && prevFacts.data ? filterFacts(prevFacts.data, filter) : null), [compare, prevFacts.data, filter])
  const now = useMemo(() => summarize(f), [f])
  const before = useMemo(() => (fp ? summarize(fp) : null), [fp])
  const points = useMemo(() => daily(f, range), [f, range])
  const people = useMemo(() => byPerson(f), [f])
  const cover = useMemo(() => coverage(f, range), [f, range])
  const grid = useMemo(() => heat(f), [f])
  const series = points.map((p) => ({ date: p.date, value: p.done + p.refused + p.closed }))
  const projection = project(series, today)
  const direction = trend(series, today)

  const names = new Map(all.people.map((p) => [p.id, { first: p.first, last: p.last }]))
  const channelName = (id: number) => catalogs?.channels?.find((c) => c.id === id)?.name ?? 'Canal'
  const sellerName = (id: number) => catalogs?.sellers?.find((s) => s.id === id)?.name ?? 'Vendedor'
  const brandName = (id: number) => catalogs?.brands.find((b) => b.id === id)?.name ?? 'Marca'
  const metrics = catalogs?.metrics ?? []
  const areas = [...new Set(all.stores.map((s) => s.area).filter((a): a is string => Boolean(a)))].sort()
  const reading = insights({
    now, before, projection, trend: direction, people, names: (id) => names.get(id)?.first ?? 'Alguien',
    channels: breakdown(f, 'ch'), channelName: (key) => (key ? channelName(Number(key)) : 'sin canal'), coverage: cover, heat: grid,
  })
  const filtered = filter !== NO_FILTER && Object.values(filter).some((v) => v !== null)
  const pick = (v: string) => (v === '' ? null : Number(v))

  const filters = (
    <div className={styles.filters}>
      <Select label="Activador" hideLabel size="sm" value={filter.person ?? ''} onChange={(v) => setFilter((x) => ({ ...x, person: v || null }))}
        options={[{ value: '', label: 'Todo el equipo' }, ...all.people.map((p) => ({ value: p.id, label: `${p.first} ${p.last}` }))]} />
      {areas.length ? (
        <Select label="Zona" hideLabel size="sm" value={filter.area ?? ''} onChange={(v) => setFilter((x) => ({ ...x, area: v || null }))}
          options={[{ value: '', label: 'Todas las zonas' }, ...areas.map((a) => ({ value: a, label: a }))]} />
      ) : null}
      {catalogs?.channels?.length ? (
        <Select label="Canal" hideLabel size="sm" value={filter.channel ?? ''} onChange={(v) => setFilter((x) => ({ ...x, channel: pick(v) }))}
          options={[{ value: '', label: 'Todos los canales' }, ...catalogs.channels.map((c) => ({ value: c.id, label: c.name }))]} />
      ) : null}
      {catalogs?.sellers?.length ? (
        <Select label="Vendedor" hideLabel size="sm" value={filter.seller ?? ''} onChange={(v) => setFilter((x) => ({ ...x, seller: pick(v) }))}
          options={[{ value: '', label: 'Todos los vendedores' }, ...catalogs.sellers.map((s) => ({ value: s.id, label: s.name }))]} />
      ) : null}
      {filtered ? <Button variant="ghost" size="sm" onClick={() => setFilter(NO_FILTER)}><X size={16} aria-hidden />Limpiar</Button> : null}
    </div>
  )

  const exportCsv = () => downloadCsv(`visitario-${range.from}-${range.to}.csv`, { range, now, points, people, names, metrics })

  return (
    <div className={styles.panel}>
      <div className={styles.bar}>
        {controls}
        <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!f.visits.length}><Download size={16} aria-hidden />Exportar CSV</Button>
      </div>
      {filters}

      {facts.isError ? <Banner tone="error">No pudimos cargar los reportes. Revisá la conexión.</Banner> : null}
      {facts.isPending ? (
        <Skeleton height={420} shape="block" />
      ) : !f.visits.length ? (
        <Banner tone="info" title={`Sin visitas del ${rangeLabel(range)}`}>Probá con otro período o sacá los filtros.</Banner>
      ) : (
        <Refreshing active={facts.isPlaceholderData || (compare && prevFacts.isPlaceholderData)} className={styles.body}>
          <KpiTiles items={kpisOf(now, before, cover.share)} compare={compare && Boolean(before)} />

          {reading.length ? (
            <PanelCard title="Lectura rápida" hint="Lo que dicen los números, en pocas palabras.">
              <ul className={styles.reading}>
                {reading.map((r) => (
                  <li key={r.text} data-tone={r.tone}>
                    {r.tone === 'good' ? <TrendingUp size={18} aria-hidden /> : r.tone === 'bad' ? <TrendingDown size={18} aria-hidden /> : <Lightbulb size={18} aria-hidden />}
                    {r.text}
                  </li>
                ))}
              </ul>
            </PanelCard>
          ) : null}

          <div className={styles.grid}>
            <PanelCard wide title="Visitas por día" hint={`Del ${rangeLabel(range)}, por cómo terminaron.`}
              aside={projection ? (
                <p className={styles.estimate}>
                  Estimado al cierre: <b>~{num(projection.projected)}</b>
                  <span>entre {num(projection.low)} y {num(projection.high)} · {projection.remaining === 1 ? 'queda 1 día hábil' : `quedan ${num(projection.remaining)} días hábiles`}</span>
                </p>
              ) : direction !== null ? (
                <p className={styles.estimate}>Tendencia: <b>{signed(direction)}</b><span>por semana, en días hábiles</span></p>
              ) : null}>
              <DailyChart points={points} today={today} rate={projection?.rate ?? null} />
            </PanelCard>

            <PanelCard wide title="Activadores" hint="Tocá un nombre para ver solo a esa persona.">
              <PeopleRanking rows={people} names={names} metric={metrics[0]} onPick={(id) => setFilter((x) => ({ ...x, person: id }))} />
            </PanelCard>

            <PanelCard title="Dónde se trabaja" hint="Visitas con resultado por canal, vendedor o zona.">
              <SliceBars facts={f} channelName={channelName} sellerName={sellerName} />
            </PanelCard>

            <PanelCard title="Cuándo se llega" hint="Llegadas a los locales por día y hora.">
              <Heatmap grid={grid} />
            </PanelCard>

            <PanelCard wide title="Trabajo realizado" hint="Los números de trabajo de la empresa, con su estimado al cierre.">
              <WorkCard metrics={metrics} totals={now.metrics} before={before?.metrics ?? null} points={points} today={today}
                brands={brandShare(f).map((b) => ({ name: brandName(b.id), visits: b.visits, share: b.share }))} />
            </PanelCard>

            <PanelCard title="Cobertura del directorio" hint="Días desde la última visita de cada comercio activo.">
              <CoverageCard c={cover} from={here} />
            </PanelCard>

            <PanelCard title="Cómo los recibieron" hint="El trato de los comercios en las visitas del período.">
              <RapportCard counts={now.rapport} />
            </PanelCard>
          </div>
        </Refreshing>
      )}
    </div>
  )
}
