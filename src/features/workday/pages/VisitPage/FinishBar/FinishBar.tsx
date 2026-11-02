import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Check, Clock, RefreshCw, Undo2 } from 'lucide-react'
import { formatTime } from '@/domain/dates'
import { canReopen, finishCheck, isLocked, isVisited, staleSoon, WORK_STATUS_LABEL } from '@/domain/visit'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { useConfirm } from '@/ui/ConfirmDialog'
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
  const resetsAt = staleSoon(v)
  const { confirm, dialog } = useConfirm()

  // Ending a visit asks first: a tap by mistake should not close it.
  const end = async () => {
    const as = check.target ? WORK_STATUS_LABEL[check.target].toLowerCase() : ''
    const left = check.unarranged ? ` ${check.unarranged === 1 ? 'Queda 1 exhibición sin acomodar para retomar.' : `Quedan ${check.unarranged} exhibiciones sin acomodar para retomar.`}` : ''
    const ok = await confirm({
      title: closedChoice ? '¿Confirmás que estaba cerrado?' : '¿Terminar la visita?',
      description: `Queda como ${as}.${left} Si te equivocás, la podés deshacer.`,
      confirmLabel: closedChoice ? 'Sí, estaba cerrado' : 'Sí, terminar',
    })
    if (!ok) return
    await actions.finish()
    await navigate(back)
  }

  const reopen = async () => {
    const ok = await confirm({
      title: '¿Deshacer terminada?',
      description: 'La visita vuelve a En curso para que la corrijas. Lo cargado se mantiene; terminala de nuevo cuando esté lista.',
      confirmLabel: 'Sí, deshacer',
    })
    if (ok) await actions.reopen()
  }

  return (
    <div className={styles.bar}>
      {dialog}
      {actions.error ? <Banner tone="error">{actions.error.message}</Banner> : null}
      {finished ? (
        <>
          <p className={styles.status}>
            <Check size={16} strokeWidth={3} aria-hidden />
            {WORK_STATUS_LABEL[v.workStatus]}{v.finishedAt ? ` a las ${formatTime(v.finishedAt)}` : ''}
          </p>
          {v.workStatus === 'closed' && !isLocked(v) ? (
            <Button variant="secondary" size="md" onClick={actions.retry} loading={actions.saving}>
              <RefreshCw size={18} aria-hidden />Volví: probar de nuevo
            </Button>
          ) : null}
          {canReopen(v) ? (
            <Button variant="secondary" size="md" onClick={() => void reopen()} loading={actions.saving}>
              <Undo2 size={18} aria-hidden />Deshacer terminada
            </Button>
          ) : null}
        </>
      ) : (
        <>
          {resetsAt ? (
            <p className={styles.warn}>
              <Clock size={16} aria-hidden />
              Terminala antes de las {formatTime(resetsAt)}: si no, vuelve a pendiente y se borra lo cargado.
            </p>
          ) : null}
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
