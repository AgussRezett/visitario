import { Check, MessageSquareWarning, Send } from 'lucide-react'
import { Button } from '@/ui/Button'
import type { Visit } from '@/features/workday/api/queries'
import { Conversation } from '@/features/workday/components/Conversation'
import { useVisitComments } from '@/features/sync/hooks'
import type { VisitActions } from '../useVisitActions'
import styles from './CorrectionPanel.module.scss'

interface CorrectionPanelProps {
  visit: Visit
  actions: VisitActions
  meId: string
  displayLabel: (displayId: string) => string | undefined
}

/**
 * The supervisor's fix request and the conversation about it; "Reenviar" sends the visit
 * back to review. Works without signal like the rest of the visit (A14 / AD11).
 */
export function CorrectionPanel({ visit: v, actions, meId, displayLabel }: CorrectionPanelProps) {
  const comments = useVisitComments(v.id)
  const list = comments.data ?? []
  if (v.reviewStatus !== 'needs_fix' && !list.length) return null
  const request = [...list].reverse().find((c) => c.kind === 'fix_request')
  const who = request?.authorName.split(' ')[0] || 'Tu supervisor'
  const fixing = v.reviewStatus === 'needs_fix'

  return (
    <section className={styles.panel} data-fixing={fixing || undefined} aria-label="Corrección">
      {fixing ? (
        <div className={styles.head}>
          <span className={styles.icon}><MessageSquareWarning size={20} aria-hidden /></span>
          <span className={styles.titles}>
            <span className={styles.title}>{who} pidió una corrección</span>
            <span className={styles.sub}>Revisá lo que falta, corregí y reenviá.</span>
          </span>
        </div>
      ) : (
        <h3 className={styles.heading}>Conversación con tu supervisor</h3>
      )}
      <Conversation
        comments={list}
        meId={meId}
        displayLabel={displayLabel}
        onSend={(body) => actions.changes.comment(meId, body)}
        placeholder={`Responder a ${who}`}
      />
      {fixing ? (
        <Button onClick={() => void actions.changes.resubmit()} className={styles.resubmit}>
          <Send size={18} aria-hidden />Reenviar al supervisor
        </Button>
      ) : v.reviewStatus === 'unreviewed' && request ? (
        <p className={styles.sent}><Check size={16} strokeWidth={3} aria-hidden />Reenviada: esperando la revisión.</p>
      ) : null}
    </section>
  )
}
