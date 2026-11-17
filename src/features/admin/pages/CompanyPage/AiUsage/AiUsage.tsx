import { useQuery } from '@tanstack/react-query'
import { monthShare, renewsOn } from '@/domain/ai-quota'
import { todayInArgentina } from '@/domain/dates'
import { Select } from '@/ui/Select'
import { Skeleton } from '@/ui/Skeleton'
import { aiQuotaQuery } from '@/features/import/api/capture'
import { companyAiUsageQuery } from '@/features/admin/api/ai-usage'
import styles from './AiUsage.module.scss'

const PER_PERSON = [10, 20, 30, 50, 100]
const NO_LIMIT = 'none'

interface AiUsageProps {
  companyId: string
  /** Captures each person may use a day; null: no limit. */
  perPerson: number | null | undefined
  onPerPerson: (n: number | null) => void
  cardClass?: string
  headingClass?: string
  helpClass?: string
}

/** The company's AI this month (captures and route requests): what it used of its limit, who used it, and each person's day. */
export function AiUsage({ companyId, perPerson, onPerPerson, cardClass, headingClass, helpClass }: AiUsageProps) {
  const quota = useQuery(aiQuotaQuery(companyId))
  const usage = useQuery(companyAiUsageQuery(companyId))
  const q = quota.data
  const share = q ? monthShare(q.monthUsed, q.monthLimit) : 0
  const people = usage.data?.people ?? []

  return (
    <section className={cardClass} aria-label="Uso de IA">
      <h2 className={headingClass}>Uso de IA</h2>
      {q ? (
        q.monthLimit > 0 ? (
          <div className={styles.month}>
            <p className={styles.count}><b>{q.monthUsed}</b> de {q.monthLimit} este mes</p>
            <div className={styles.bar} role="progressbar" aria-label="Usos de IA este mes" aria-valuemin={0} aria-valuemax={q.monthLimit} aria-valuenow={q.monthUsed} data-level={share >= 90 ? 'high' : share >= 70 ? 'mid' : undefined}>
              <span style={{ width: `${share}%` }} />
            </div>
            <p className={helpClass}>Se renuevan el {renewsOn(todayInArgentina())}. El límite del mes lo fija Visitario según el plan.</p>
          </div>
        ) : (
          <p className={helpClass}>La lectura con IA no está incluida en el plan. Para sumarla, avisale a Visitario.</p>
        )
      ) : quota.isPending ? <Skeleton height={64} /> : null}

      <Select
        label="Por persona, por día"
        value={perPerson == null ? NO_LIMIT : perPerson}
        disabled={perPerson === undefined}
        onChange={(v) => onPerPerson(v === NO_LIMIT ? null : Number(v))}
        options={[...PER_PERSON.map((n) => ({ value: n, label: `${n} usos` })), { value: NO_LIMIT, label: 'Sin límite' }]}
      />
      <p className={helpClass}>Leer una captura o pedir un recorrido escrito es un uso. Así nadie usa solo todo el mes; cada uno ve cuántos le quedan.</p>

      {people.length ? (
        <ul className={styles.people} aria-label="Quién la usó este mes">
          {people.map((p) => (
            <li key={p.name} className={styles.person}>
              <span className={styles.name}>{p.name}</span>
              <span className={styles.uses}>{p.month} este mes{p.today ? ` · ${p.today} hoy` : ''}</span>
            </li>
          ))}
        </ul>
      ) : usage.isSuccess ? (
        <p className={helpClass}>Todavía nadie usó la IA este mes.</p>
      ) : null}
    </section>
  )
}
