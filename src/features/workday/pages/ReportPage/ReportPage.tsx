import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Check, Copy, RefreshCw, Share2 } from 'lucide-react'
import { formatLongDate, todayInArgentina } from '@/domain/dates'
import { buildDailyReport, reportTotals } from '@/domain/report'
import { canShare, share, useCopy } from '@/lib/share'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { StatusChip } from '@/ui/StatusChip'
import { Table } from '@/ui/Table'
import { TextArea } from '@/ui/TextArea'
import { useWorkContext } from '@/features/workday/context'
import { dayMetricsQuery, historyQuery, useCatalogs, visitsQuery, workdayQuery } from '@/features/workday/api/queries'
import { WeekStrip } from '@/features/workday/components/WeekStrip'
import { ReportSkeleton } from '@/features/workday/components/Skeletons'
import styles from './ReportPage.module.scss'

/** The day's report, generated from the visits, editable and ready to copy (wireframes A16 / AD13). */
export function ReportPage({ date: requested }: { date?: string }) {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const date = requested ?? todayInArgentina()
  const on = Boolean(ctx)
  const companyId = ctx?.companyId ?? ''
  const personId = ctx?.personId ?? ''
  const workday = useQuery({ ...workdayQuery(companyId, personId, date), enabled: on })
  const visits = useQuery({ ...visitsQuery(workday.data?.id ?? '', personId), enabled: Boolean(workday.data) })
  const metrics = useQuery({ ...dayMetricsQuery(companyId, personId, date), enabled: on })
  const history = useQuery({ ...historyQuery(companyId, personId), enabled: on })
  const catalogs = useCatalogs(companyId)
  const { copied, copy } = useCopy()

  const reportVisits = useMemo(
    () => (visits.data ?? []).map((v) => ({ address: v.store.address, added: v.source === 'added', workStatus: v.workStatus })),
    [visits.data],
  )
  const reportMetrics = useMemo(
    () => (catalogs.data?.metrics ?? []).map((m) => ({ name: m.name, reportLabel: m.reportLabel, total: metrics.data?.[m.id] ?? 0 })),
    [catalogs.data, metrics.data],
  )
  const generated = useMemo(
    () => (catalogs.data ? buildDailyReport({ date, visits: reportVisits, metrics: reportMetrics, template: catalogs.data.templates.daily_report }) : ''),
    [catalogs.data, date, reportVisits, reportMetrics],
  )
  const [text, setText] = useState(generated)
  useEffect(() => setText(generated), [generated])
  const totals = reportTotals(reportVisits)

  if (!ctx) return null
  const goTo = (d: string) => navigate({ to: '/s/report', search: d === todayInArgentina() ? {} : { date: d } })

  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <div className={styles.titles}>
          <h1 className={styles.title}>Informe del día</h1>
          <p className={styles.sub}>{formatLongDate(date)}</p>
        </div>
        <div className={styles.desktopActions}>
          <Button variant="secondary" size="md" onClick={() => setText(generated)}><RefreshCw size={18} aria-hidden />Regenerar</Button>
          <Button size="md" onClick={() => copy('report', text)}>
            {copied === 'report' ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
            {copied === 'report' ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
      </div>

      <div className={styles.week}>
        <WeekStrip date={date} days={history.data ?? []} onSelect={goTo} />
      </div>

      {workday.isPending || (workday.data && visits.isPending) ? (
        <ReportSkeleton />
      ) : workday.isSuccess && !workday.data ? (
        <Banner tone="info">No tenés jornada ese día. Elegí otro día arriba.</Banner>
      ) : (
        <>
          <div className={styles.kpis}>
            <div className={styles.kpi}><b>{totals.visited}</b><span>visitados</span></div>
            {reportMetrics.map((m) => (
              <div key={m.name} className={styles.kpi}><b>{m.total}</b><span>{m.name.toLowerCase()}</span></div>
            ))}
            <div className={styles.kpi}><b>{totals.extras}</b><span>extras</span></div>
          </div>

          <Banner tone="ok" icon={<Check size={18} aria-hidden />}>Tu supervisor ya lo ve en Visitario. Copialo solo si te lo piden por WhatsApp.</Banner>

          <div className={styles.columns}>
            <div className={styles.textColumn}>
              <TextArea
                label="Texto del informe"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className={styles.text}
                help="Lo que edites acá no cambia las visitas guardadas. Regenerar vuelve al texto original."
              />
              <div className={styles.phoneActions}>
                <Button size="md" onClick={() => copy('report', text)}>
                  {copied === 'report' ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
                  {copied === 'report' ? 'Copiado' : 'Copiar'}
                </Button>
                {canShare() ? (
                  <Button variant="secondary" size="md" aria-label="Compartir" onClick={() => share({ text })}><Share2 size={18} aria-hidden /></Button>
                ) : null}
                <Button variant="secondary" size="md" aria-label="Regenerar" onClick={() => setText(generated)}><RefreshCw size={18} aria-hidden /></Button>
              </div>
            </div>
            {visits.data?.length ? (
              <Table className={styles.table} label="Resultado por comercio">
                <thead><tr><th>Comercio</th><th>Resultado</th></tr></thead>
                <tbody>
                  {visits.data.map((v) => (
                    <tr key={v.id}>
                      <td className={styles.strong}>{v.store.address}{v.source === 'added' ? ' · extra' : ''}</td>
                      <td><StatusChip work={v.workStatus} review={v.reviewStatus} label={v.workStatus === 'pending' ? 'No visitado' : undefined} /></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
