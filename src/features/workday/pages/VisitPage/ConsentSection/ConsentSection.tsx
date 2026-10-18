import { useEffect, useState } from 'react'
import { Check, Clock, DoorClosed, ShieldQuestion } from 'lucide-react'
import clsx from 'clsx'
import { formatTime } from '@/domain/dates'
import { CONSENT_LABEL, isLocked, type Consent } from '@/domain/visit'
import { RAPPORT_LABEL, RAPPORTS } from '@/domain/reputation'
import { Banner } from '@/ui/Banner'
import { Field } from '@/ui/Field'
import { Segmented } from '@/ui/Segmented'
import type { Visit } from '@/features/workday/api/queries'
import { VisitSection } from '@/features/workday/components/VisitSection'
import type { VisitActions } from '../useVisitActions'
import styles from './ConsentSection.module.scss'

const CHOICES: Consent[] = ['yes', 'with_objection', 'refused', 'closed']

/** The store's answer: yes, yes with an objection, no, or closed (with a retry). */
export function ConsentSection({ visit: v, actions }: { visit: Visit; actions: VisitActions }) {
  const [objection, setObjection] = useState(v.objection ?? '')
  useEffect(() => setObjection(v.objection ?? ''), [v.objection])
  const closed = v.consent === 'closed'
  const locked = isLocked(v)

  return (
    <VisitSection
      state={closed ? 'warn' : v.consent ? 'ok' : 'todo'}
      icon={closed ? <DoorClosed size={16} /> : v.consent ? <Check size={16} strokeWidth={3} /> : <ShieldQuestion size={16} />}
      title={closed ? 'El local estaba cerrado' : 'Autorización'}
      subtitle={closed && v.finishedAt ? `Intento a las ${formatTime(v.finishedAt)}` : closed ? 'Si volvés más tarde, probá de nuevo' : undefined}
    >
      <div className={styles.choices} role="radiogroup" aria-label="¿El local te autorizó?">
        {CHOICES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={v.consent === c}
            className={clsx(styles.choice, v.consent === c && styles.on)}
            disabled={locked || actions.saving}
            onClick={() => v.consent !== c && actions.setConsent(c)}
          >
            {v.consent === c ? <Check size={16} strokeWidth={3} aria-hidden /> : null}
            {CONSENT_LABEL[c]}
          </button>
        ))}
      </div>

      {v.consent === 'yes' || v.consent === 'with_objection' ? (
        <div className={styles.field}>
          <span className={styles.label} id={`rapport-${v.id}`}>¿Cómo te recibieron? <span className={styles.optional}>Opcional</span></span>
          <div className={styles.rapport} role="radiogroup" aria-labelledby={`rapport-${v.id}`}>
            {RAPPORTS.filter((r) => r !== 'unwilling').map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={v.rapport === r}
                className={clsx(styles.choice, v.rapport === r && styles.on)}
                disabled={locked || actions.saving}
                onClick={() => actions.setRapport(v.rapport === r ? null : r)}
              >
                {v.rapport === r ? <Check size={16} strokeWidth={3} aria-hidden /> : null}
                {RAPPORT_LABEL[r]}
              </button>
            ))}
          </div>
          <span className={styles.help}>Suma a la reputación del comercio. Tocá de nuevo para quitarlo.</span>
        </div>
      ) : null}

      {v.consent === 'with_objection' ? (
        <Field
          label="Qué objetó el encargado"
          value={objection}
          onChange={(e) => setObjection(e.target.value)}
          onBlur={() => objection !== (v.objection ?? '') && actions.setObjection(objection)}
          placeholder="Ej.: permiten ordenar, sin cartelería"
          maxLength={300}
        />
      ) : null}

      {closed ? (
        <>
          <div className={styles.field}>
            <span className={styles.label}>¿Cuándo volvés?</span>
            <Segmented
              label="¿Cuándo volvés?"
              value={v.retryAfter ? 'later' : 'no'}
              onChange={(value) => actions.setRetry(value === 'later')}
              options={[
                { value: 'later', label: 'Hoy, desde las 17 h' },
                { value: 'no', label: 'No vuelvo hoy' },
              ]}
            />
          </div>
          <Banner tone="info" icon={<Clock size={18} aria-hidden />}>
            Cuenta como visitada en el informe aunque siga cerrado. Si no volvés, la podés retomar otro día.
          </Banner>
        </>
      ) : null}
    </VisitSection>
  )
}
