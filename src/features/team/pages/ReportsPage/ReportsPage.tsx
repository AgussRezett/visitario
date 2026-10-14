import { useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Check, Copy, FileSpreadsheet, Share2 } from 'lucide-react'
import clsx from 'clsx'
import { formatLongDate, todayInArgentina } from '@/domain/dates'
import { memberDay, memberReport, reviewSummary, teamReport, teamTotals, type MemberDay } from '@/domain/team-report'
import { initials } from '@/lib/format'
import { canShare, share, useCopy } from '@/lib/share'
import { Avatar } from '@/ui/Avatar'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Refreshing } from '@/ui/Refreshing'
import { Skeleton } from '@/ui/Skeleton'
import { useWorkContext } from '@/features/workday/context'
import { useCatalogs } from '@/features/workday/api/queries'
import { teamDayQuery } from '../../api/queries'
import { teamReportQuery } from '../../api/reports'
import { ReportsTable } from './ReportsTable'
import { CHIP } from './chip'
import styles from './ReportsPage.module.scss'

/** What a person's row says under the name on the phone: what stands out that day. */
function standout(r: MemberDay, firstMetric: { id: number; name: string } | undefined) {
  const parts = [firstMetric ? `${r.metrics[firstMetric.id] ?? 0} ${firstMetric.name.toLowerCase()}` : null]
  if (r.refused) parts.push(`${r.refused} no aut.`)
  if (r.notVisited) parts.push(`${r.notVisited} no visit.`)
  if (r.needsFix) parts.push(r.needsFix === 1 ? '1 corrección' : `${r.needsFix} correcciones`)
  return parts.filter(Boolean).join(' · ')
}

/** The team's day in numbers and each one's report, ready to copy (wireframes S08, SM08). */
export function ReportsPage({ date: requested }: { date?: string }) {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const date = requested ?? todayInArgentina()
  const companyId = ctx?.companyId ?? ''
  const team = useQuery({ ...teamDayQuery(companyId, date), enabled: Boolean(ctx), placeholderData: keepPreviousData })
  const data = useQuery({ ...teamReportQuery(companyId, date), enabled: Boolean(ctx), placeholderData: keepPreviousData })
  const catalogs = useCatalogs(companyId)
  const { copied, copy } = useCopy()
  const [chosen, setChosen] = useState<string | null>(null)

  const metrics = useMemo(() => catalogs.data?.metrics ?? [], [catalogs.data])
  const rows = useMemo(
    () =>
      (team.data ?? [])
        .map((m) => memberDay({ personId: m.personId, name: m.firstName }, data.data?.visits ?? [], data.data?.metrics[m.personId]))
        .filter((r) => r.total > 0),
    [team.data, data.data],
  )
  const totals = teamTotals(rows)
  const reportOf = (personId: string) =>
    catalogs.data && data.data
      ? memberReport({
          date,
          personId,
          visits: data.data.visits,
          metrics: metrics.map((m) => ({ name: m.name, reportLabel: m.reportLabel, total: data.data?.metrics[personId]?.[m.id] ?? 0 })),
          template: catalogs.data.templates.daily_report,
        })
      : ''
  const selected = rows.find((r) => r.personId === chosen) ?? rows[0]
  const selectedText = selected ? reportOf(selected.personId) : ''
  const lastName = (personId: string) => team.data?.find((m) => m.personId === personId)?.lastName ?? ''

  if (!ctx) return null
  const loading = team.isPending || data.isPending || catalogs.isPending
  const copyTeam = () => copy('team', teamReport(date, rows.map((r) => ({ name: r.name, text: reportOf(r.personId) }))))

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.titles}>
          <span className={styles.eyebrow}>Informes</span>
          <h1 className={styles.title}>{formatLongDate(date)}</h1>
        </div>
        <div className={styles.actions}>
          <label className={styles.date}>
            <span className={styles.srOnly}>Fecha</span>
            <input type="date" value={date} max={todayInArgentina()} onChange={(e) => e.target.value && navigate({ to: '/s/reports', search: e.target.value === todayInArgentina() ? {} : { date: e.target.value } })} />
          </label>
          <Button variant="secondary" size="sm" className={styles.desktopOnly} onClick={copyTeam} disabled={!rows.length}>
            {copied === 'team' ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}{copied === 'team' ? 'Copiado' : 'Copiar informe del equipo'}
          </Button>
          <Button variant="secondary" size="sm" className={styles.desktopOnly} disabled><FileSpreadsheet size={18} aria-hidden />Excel / PDF · próximamente</Button>
        </div>
      </header>

      {team.isError || data.isError ? <Banner tone="error">No pudimos cargar los informes. Revisá la conexión.</Banner> : null}

      {loading ? (
        <Skeleton height={220} shape="block" />
      ) : !rows.length ? (
        <Banner tone="info" title="Nadie del equipo tiene visitas ese día">Elegí otra fecha arriba.</Banner>
      ) : (
        <Refreshing active={team.isPlaceholderData || data.isPlaceholderData} className={styles.body}>
          <div className={styles.kpis}>
            <div className={styles.kpi}><b>{totals.visited}/{totals.total}</b><span>visitados por el equipo</span></div>
            {metrics[0] ? <div className={styles.kpi}><b>{totals.metrics[metrics[0].id] ?? 0}</b><span>{metrics[0].name.toLowerCase()}</span></div> : null}
          </div>

          <ReportsTable rows={rows} totals={totals} metrics={metrics} selectedId={selected?.personId} onSelect={setChosen} lastName={lastName} />

          <ul className={styles.people} aria-label="Activadores">
            {rows.map((r) => (
              <li key={r.personId}>
                <button type="button" className={styles.person} aria-pressed={r.personId === selected?.personId} onClick={() => setChosen(r.personId)}>
                  <Avatar name={initials(r.name, lastName(r.personId))} size={32} />
                  <span className={styles.personText}>
                    <span className={styles.personName}>{r.name}</span>
                    <span className={styles.personNote}>{standout(r, metrics[0])}</span>
                  </span>
                  <span className={styles.personCount}>{r.visited}/{r.total}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className={styles.side}>
            {selected ? (
              <section className={styles.card} aria-label={`Informe de ${selected.name}`}>
                <div className={styles.cardHead}>
                  <h2 className={styles.cardTitle}>Informe de {selected.name}</h2>
                  <span className={clsx(styles.chip, CHIP[reviewSummary(selected).tone])}>{reviewSummary(selected).label}</span>
                  <span className={styles.cardActions}>
                    <Button variant="secondary" size="sm" onClick={() => copy('member', selectedText)} aria-label="Copiar">
                      {copied === 'member' ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}<span className={styles.desktopOnly}>{copied === 'member' ? 'Copiado' : 'Copiar'}</span>
                    </Button>
                    {canShare() ? <Button variant="secondary" size="sm" onClick={() => share({ text: selectedText })} aria-label="Compartir"><Share2 size={16} aria-hidden /></Button> : null}
                  </span>
                </div>
                <pre className={styles.report}>{selectedText}</pre>
              </section>
            ) : null}
            <section className={clsx(styles.card, styles.desktopOnly)} aria-label="Reportes para presentar">
              <p className={styles.cardTitle}>Reportes para presentar <span className={styles.paid}>Plan pago</span></p>
              <p className={styles.muted}>Estadísticas por período, zona y comercio, con diseño de Visitario para compartir con tu empresa. Llega después de la primera versión.</p>
              <Button variant="secondary" size="sm" disabled>Próximamente</Button>
            </section>
          </div>

          <div className={styles.phoneFooter}>
            <Button onClick={copyTeam}>{copied === 'team' ? <Check size={20} aria-hidden /> : <Copy size={20} aria-hidden />}{copied === 'team' ? 'Copiado' : 'Copiar informe del equipo'}</Button>
          </div>
        </Refreshing>
      )}
    </div>
  )
}
