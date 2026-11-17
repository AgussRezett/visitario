import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { quotaLeft, quotaText } from '@/domain/ai-quota'
import { understand, type PlanCatalog, type UnderstoodPlan } from '@/domain/plan-request'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { TextArea } from '@/ui/TextArea'
import { aiQuotaQuery, useRefreshQuota } from '@/features/import/api/capture'
import { askPlan, PlanRequestError } from '@/features/routeplan/api'
import styles from './AiRequest.module.scss'

interface AiRequestProps {
  companyId: string
  today: string
  catalog: PlanCatalog
  /** What was understood, to fill in the goal and filters. */
  onApply: (u: UnderstoodPlan) => void
}

/** The route asked for in words; the AI fills in the goal and filters, to check before planning. */
export function AiRequest({ companyId, today, catalog, onApply }: AiRequestProps) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [read, setRead] = useState<UnderstoodPlan | null>(null)
  const quota = useQuery(aiQuotaQuery(companyId))
  const refreshQuota = useRefreshQuota(companyId)
  const closed = quota.data ? quotaLeft(quota.data).left === 0 : false

  const ask = async () => {
    setBusy(true)
    setError(null)
    setRead(null)
    try {
      const u = understand(await askPlan(companyId, text.trim(), today), catalog, today)
      if (!u.chips.length) throw new PlanRequestError(u.unknown.length ? `No encontramos ${u.unknown.join(', ')}. Elegí los filtros a mano.` : 'No pudimos entender el pedido. Probá decirlo de otra forma, o elegí los filtros a mano.')
      setRead(u)
      onApply(u)
    } catch (e) {
      setError(e instanceof PlanRequestError ? e.message : 'No pudimos entender el pedido. Revisá la conexión y probá de nuevo.')
    } finally {
      setBusy(false)
      void refreshQuota()
    }
  }

  return (
    <section className={styles.box} aria-label="Pedido escrito">
      <TextArea
        label="Pedilo con IA"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="Ej.: 12 locales de Mirko en Palermo que no se activaron este mes y que reciban bien, a pie, para Lucía mañana"
        help={quota.data ? quotaText(quota.data) : 'La IA completa el objetivo y los filtros; vos los revisás antes de armar.'}
      />
      <Button variant="secondary" size="md" onClick={() => void ask()} disabled={text.trim().length < 3 || closed} loading={busy} className={styles.ask}>
        <Sparkles size={18} aria-hidden />Entender el pedido
      </Button>
      {read ? (
        <Banner tone="ok" title="Entendí esto: revisalo y tocá Armar recorrido">
          <ul className={styles.chips}>{read.chips.map((c) => <li key={c} className={styles.chip}>{c}</li>)}</ul>
          {read.unknown.length ? <p className={styles.unknown}>No encontramos {read.unknown.join(', ')}: lo dejamos afuera.</p> : null}
        </Banner>
      ) : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
    </section>
  )
}
