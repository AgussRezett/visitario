import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Check, RefreshCw } from 'lucide-react'
import { formatTime } from '@/domain/dates'
import { finishCheck, isVisited, WORK_STATUS_LABEL } from '@/domain/visit'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import type { Visit } from '@/features/workday/api/queries'
import type { VisitActions } from '../useVisitActions'
import styles from './FinishBar.module.scss'

const BLOCKER_TEXT = {
  storefront: 'Falta la foto de la fachada.',
  consent: 'Falta marcar si el local te autorizó.',
}

/** Sticky footer on phones: what is missing and the button to end the visit. */
export function FinishBar({ visit: v, actions, back }: { visit: Visit; actions: VisitActions; back: { to: '/s/workday'; search: { date?: string } } }) {
  const navigate = useNavigate()
  const check = finishCheck({
    workStatus: v.workStatus,
    consent: v.consent,
    hasStorefront: v.photos.some((p) => p.kind === 'storefront'),
    displays: v.displays.map((d) => ({ arranged: v.photos.some((p) => p.displayId === d.id && p.kind === 'after') })),
  })
  const finished = isVisited(v.workStatus)
  const closedChoice = v.consent === 'closed'

  const end = async () => {
    await actions.finish()
    await navigate(back)
  }

  return (
    <div className={styles.bar}>
      {actions.error ? <Banner tone="error">{actions.error.message}</Banner> : null}
      {finished ? (
        <>
          <p className={styles.status}>
            <Check size={16} strokeWidth={3} aria-hidden />
            {WORK_STATUS_LABEL[v.workStatus]}{v.finishedAt ? ` a las ${formatTime(v.finishedAt)}` : ''}
          </p>
          {v.workStatus === 'closed' && v.reviewStatus !== 'approved' ? (
            <Button variant="secondary" size="md" onClick={actions.retry} loading={actions.saving}>
              <RefreshCw size={18} aria-hidden />Volví: probar de nuevo
            </Button>
          ) : null}
        </>
      ) : (
        <>
          {check.blockers.length ? <p className={styles.missing}>{check.blockers.map((b) => BLOCKER_TEXT[b]).join(' ')}</p> : null}
          {!check.blockers.length && check.unarranged ? (
            <p className={styles.warn}>
              <AlertTriangle size={16} aria-hidden />
              {check.unarranged === 1 ? '1 exhibición sin acomodar: queda para retomar' : `${check.unarranged} exhibiciones sin acomodar: quedan para retomar`}
            </p>
          ) : null}
          <div className={styles.buttons}>
            {closedChoice ? (
              <Button variant="secondary" size="md" onClick={actions.retry} disabled={actions.saving}>
                <RefreshCw size={18} aria-hidden />Volví: probar de nuevo
              </Button>
            ) : null}
            <Button onClick={end} disabled={!check.ok} loading={actions.saving} className={styles.primary}>
              {closedChoice ? 'Confirmar cerrado' : <><Check size={20} aria-hidden />Terminar visita</>}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
