import { useNavigate } from '@tanstack/react-router'
import { todayInArgentina } from '@/domain/dates'
import { PERIOD_LABEL, rangeFor, rangeLabel, type PeriodPreset, type Range } from '@/domain/report-period'
import { Field } from '@/ui/Field'
import { Segmented } from '@/ui/Segmented'
import { Select } from '@/ui/Select'
import { Switch } from '@/ui/Switch'
import { useWorkContext } from '@/features/workday/context'
import { AnalyticsPanel } from '../Panel/AnalyticsPanel'
import { DailyReports } from '../ReportsPage'
import styles from './ReportsHub.module.scss'

export interface ReportsSearch {
  view?: 'panel' | 'daily'
  period?: PeriodPreset
  from?: string
  to?: string
  /** Compare with the period before: on unless turned off. */
  compare?: boolean
  date?: string
}

const PRESETS = Object.keys(PERIOD_LABEL) as PeriodPreset[]

/** Reports: the panel of the period (figures, trends, estimates) and the day's reports to copy. */
export function ReportsHub({ search }: { search: ReportsSearch }) {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const today = todayInArgentina()
  const view = search.view ?? 'panel'
  const period = search.period ?? 'month'
  const custom: Range | undefined = search.from && search.to ? { from: search.from, to: search.to } : undefined
  const range = rangeFor(period, today, custom)
  const compare = search.compare !== false
  const go = (patch: Partial<ReportsSearch>) => void navigate({ to: '/s/reports', search: { ...search, ...patch }, replace: true })
  if (!ctx) return null

  const controls = (
    <div className={styles.controls}>
      <Select label="Período" hideLabel size="sm" value={period} searchable={false}
        onChange={(v) => {
          const p = v as PeriodPreset
          go(p === 'custom' ? { period: p, from: range.from, to: range.to } : { period: p, from: undefined, to: undefined })
        }}
        options={PRESETS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
      {period === 'custom' ? (
        <div className={styles.dates}>
          <Field label="Desde" type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && go({ from: e.target.value, to: range.to })} />
          <Field label="Hasta" type="date" value={range.to} min={range.from} max={today} onChange={(e) => e.target.value && go({ from: range.from, to: e.target.value })} />
        </div>
      ) : null}
      <Switch checked={compare} onChange={(on) => go({ compare: on ? undefined : false })} className={styles.compare}>Comparar con el período anterior</Switch>
    </div>
  )

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.titles}>
          <span className={styles.eyebrow}>Reportes de {ctx.companyName}</span>
          <h1 className={styles.title}>{view === 'panel' ? `Del ${rangeLabel(range)}` : 'Informes del día'}</h1>
        </div>
        <Segmented label="Vista" value={view} onChange={(v) => go(v === 'panel' ? { view: undefined, date: undefined } : { view: v })}
          options={[{ value: 'panel', label: 'Panel' }, { value: 'daily', label: 'Informes del día' }]} />
      </header>
      {view === 'panel'
        ? <AnalyticsPanel companyId={ctx.companyId} range={range} today={today} compare={compare} controls={controls} />
        : <DailyReports date={search.date} />}
    </div>
  )
}
