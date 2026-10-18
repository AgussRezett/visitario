import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KeyRound, Plus } from 'lucide-react'
import { formatBytes, KIND_LABEL } from '@/domain/company'
import { formatDayMonth, todayInArgentina } from '@/domain/dates'
import { FREE_TIER, PLAN_SHORT, STATUS_LABEL, companyLine, formatUsd, peopleLabel, supportOpen, type PlatformCompany } from '@/domain/platform'
import { useIsDesktop } from '@/lib/useMedia'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Skeleton } from '@/ui/Skeleton'
import { Table } from '@/ui/Table'
import { platformCompaniesQuery, platformTotalsQuery } from '@/features/platform/api'
import { CompanySheet } from './CompanySheet'
import { CreateCompanySheet } from './CreateCompanySheet'
import styles from './PlatformPage.module.scss'

const TONE = { active: 'done', expired: 'pending', canceled: 'closed' } as const

/** Visitario's own panel: every company, its plan and usage (D05 / DM06). */
export function PlatformPage() {
  const desktop = useIsDesktop()
  const companies = useQuery(platformCompaniesQuery)
  const totals = useQuery(platformTotalsQuery)
  const [open, setOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const all = companies.data ?? []
  const now = new Date()
  const t = totals.data

  const status = (c: PlatformCompany) => (c.status ? <span className={styles.chip} data-tone={TONE[c.status]}>{STATUS_LABEL[c.status]}</span> : null)
  const since = (c: PlatformCompany) => `Alta ${formatDayMonth(todayInArgentina(new Date(c.createdAt)), true)}`

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div className={styles.titles}>
          <span className={styles.eyebrow}>Super admin</span>
          <h1 className={styles.title}>Empresas{companies.data ? ` · ${all.length}` : ''}</h1>
        </div>
        <Button size="md" onClick={() => setCreating(true)} className={styles.create}><Plus size={18} aria-hidden />Crear empresa</Button>
      </header>

      <section className={styles.kpis} aria-label="La plataforma">
        {t ? (
          <>
            <div className={styles.kpi}><span className={styles.kpiLabel}>Usuarios activos</span><b>{t.activePeople}</b></div>
            <div className={styles.kpi}><span className={styles.kpiLabel}>Fotos</span><b>{formatBytes(t.photoBytes)}</b><span className={styles.kpiNote}>de {formatBytes(FREE_TIER.photoBytes)} gratis</span></div>
            <div className={styles.kpi}><span className={styles.kpiLabel}>Base de datos</span><b>{formatBytes(t.dbBytes)}</b><span className={styles.kpiNote}>de {formatBytes(FREE_TIER.dbBytes)} gratis</span></div>
            <div className={styles.kpi}><span className={styles.kpiLabel}>Capturas con IA</span><b>{t.aiCaptures}</b><span className={styles.kpiNote}>este mes · {formatUsd(t.aiCostThousandths)}</span></div>
          </>
        ) : totals.isError ? null : [0, 1, 2, 3].map((i) => <Skeleton key={i} height={88} />)}
      </section>

      {companies.isPending ? (
        <Skeleton height={240} />
      ) : companies.isError ? (
        <Banner tone="error">No pudimos cargar las empresas. Revisá la conexión.</Banner>
      ) : desktop ? (
        <Table label="Empresas de Visitario">
          <thead><tr><th>Empresa</th><th>Tipo</th><th>Plan</th><th>Usuarios</th><th>Visitas 30 días</th><th>Fotos</th><th>Estado</th></tr></thead>
          <tbody>
            {all.map((c) => (
              <tr key={c.id}>
                <td>
                  <button type="button" className={styles.who} onClick={() => setOpen(c.id)}>
                    <span className={styles.name}>{c.name}</span>
                    <span className={styles.meta}>{since(c)}{c.admins ? ` · admin ${c.admins}` : ''}{supportOpen(c, now) ? ' · soporte abierto' : ''}</span>
                  </button>
                </td>
                <td>{KIND_LABEL[c.kind]}</td>
                <td>{c.plan ? <span className={styles.plan} data-plan={c.plan}>{PLAN_SHORT[c.plan]}</span> : '—'}</td>
                <td className={styles.num}>{peopleLabel(c)}</td>
                <td className={styles.num}>{c.visits30d}</td>
                <td className={styles.num}>{c.photoBytes ? formatBytes(c.photoBytes) : '—'}</td>
                <td>{status(c)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <ul className={styles.list}>
          {all.map((c) => (
            <li key={c.id}>
              <button type="button" className={styles.row} onClick={() => setOpen(c.id)}>
                <span className={styles.whoText}>
                  <span className={styles.name}>{c.name}</span>
                  <span className={styles.meta}>{companyLine(c, KIND_LABEL[c.kind])}</span>
                </span>
                {status(c)}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Banner tone="info" icon={<KeyRound size={18} aria-hidden />}>
        El modo soporte es de solo lectura y queda registrado con fecha, persona y motivo. La empresa lo ve en Empresa y plan.
      </Banner>

      <CompanySheet company={all.find((c) => c.id === open) ?? null} onClose={() => setOpen(null)} />
      <CreateCompanySheet open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setOpen(id) }} />
    </div>
  )
}
