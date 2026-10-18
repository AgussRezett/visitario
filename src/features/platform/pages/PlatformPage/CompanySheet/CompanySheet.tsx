import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Eye, KeyRound, Save } from 'lucide-react'
import { formatBytes, KIND_LABEL, type PlanKind } from '@/domain/company'
import { formatDayMonth, formatTime, todayInArgentina } from '@/domain/dates'
import { PLAN_SHORT, STATUS_LABEL, formatUsd, peopleLabel, supportOpen, type PlatformCompany, type SubscriptionStatus } from '@/domain/platform'
import { Banner } from '@/ui/Banner'
import { Button, buttonClass } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Select } from '@/ui/Select'
import { Sheet } from '@/ui/Sheet'
import { TextArea } from '@/ui/TextArea'
import { usePlatform } from '@/features/platform/api'
import styles from './CompanySheet.module.scss'

const PLANS = (['pilot', 'team', 'free', 'internal'] as const).map((p) => ({ value: p, label: PLAN_SHORT[p] }))
const STATES = (['active', 'expired', 'canceled'] as const).map((s) => ({ value: s, label: STATUS_LABEL[s] }))

/** One company: its numbers, its plan, and a support session to look at it read-only. */
export function CompanySheet({ company, onClose }: { company: PlatformCompany | null; onClose: () => void }) {
  const { setPlan, startSupport } = usePlatform()
  const [plan, setPlanKind] = useState<PlanKind>('pilot')
  const [status, setStatus] = useState<SubscriptionStatus>('active')
  const [endsOn, setEndsOn] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!company) return
    setPlanKind(company.plan ?? 'free')
    setStatus(company.status ?? 'active')
    setEndsOn(company.endsOn ?? '')
    setReason('')
    setPlan.reset()
    startSupport.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new company starts a new form
  }, [company?.id])

  if (!company) return null
  const personal = company.kind === 'personal'
  const changed = plan !== company.plan || status !== company.status || endsOn !== (company.endsOn ?? '')
  const open = supportOpen(company, new Date())
  const facts: [string, string][] = [
    ['Usuarios', peopleLabel(company)],
    ['Admin', company.admins ?? 'Sin admin'],
    ['Visitas, últimos 30 días', String(company.visits30d)],
    ['Fotos', company.photos ? `${company.photos} · ${formatBytes(company.photoBytes)}` : 'Ninguna'],
    ['Capturas con IA este mes', `${company.aiCaptures} · ${formatUsd(company.aiCostThousandths)}`],
    ['Última actividad', company.lastActivityAt ? `${formatDayMonth(todayInArgentina(new Date(company.lastActivityAt)))} · ${formatTime(company.lastActivityAt)}` : 'Todavía nada'],
  ]

  return (
    <Sheet open onClose={onClose} title={company.name} subtitle={`${KIND_LABEL[company.kind]} · alta ${formatDayMonth(todayInArgentina(new Date(company.createdAt)), true)}`}>
      <dl className={styles.facts}>
        {facts.map(([k, v]) => (
          <div key={k} className={styles.fact}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>

      <section className={styles.block} aria-labelledby="plan-title">
        <h3 id="plan-title" className={styles.heading}>Plan</h3>
        {personal ? (
          <p className={styles.help}>El uso propio de cada activador queda en el plan gratuito.</p>
        ) : (
          <>
            <div className={styles.grid}>
              <Select label="Plan" value={plan} onChange={(e) => setPlanKind(e.target.value as PlanKind)} options={PLANS} />
              <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value as SubscriptionStatus)} options={STATES} />
            </div>
            <Field label="Vence el" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} help="Opcional. Para un piloto, el día que termina." />
            {setPlan.error ? <Banner tone="error">{setPlan.error.message}</Banner> : null}
            {setPlan.isSuccess && !changed ? <Banner tone="ok">Plan guardado.</Banner> : null}
            <Button size="md" disabled={!changed} loading={setPlan.isPending}
              onClick={() => setPlan.mutate({ companyId: company.id, plan, status, endsOn })}>
              <Save size={18} aria-hidden />Guardar plan
            </Button>
          </>
        )}
      </section>

      <section className={styles.block} aria-labelledby="support-title">
        <h3 id="support-title" className={styles.heading}>Soporte</h3>
        {open && company.supportUntil ? (
          <>
            <Banner tone="ok" icon={<KeyRound size={18} aria-hidden />} title={`Sesión abierta hasta las ${formatTime(company.supportUntil)}`}>
              Solo lectura. La empresa ve que entraste y por qué.
            </Banner>
            <Link to="/platform/$companyId" params={{ companyId: company.id }} className={buttonClass('primary', 'md')}>
              <Eye size={18} aria-hidden />Ver la empresa
            </Link>
          </>
        ) : (
          <>
            <TextArea label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={300}
              placeholder="Ej. Martín no ve las visitas de Lucía" help="Se guarda con tu nombre y la hora. La empresa lo ve." />
            {startSupport.error ? <Banner tone="error">{startSupport.error.message}</Banner> : null}
            <Button variant="secondary" size="md" disabled={reason.trim().length < 10} loading={startSupport.isPending}
              onClick={() => startSupport.mutate({ companyId: company.id, reason })}>
              <KeyRound size={18} aria-hidden />Abrir soporte por 2 horas
            </Button>
          </>
        )}
      </section>
    </Sheet>
  )
}
