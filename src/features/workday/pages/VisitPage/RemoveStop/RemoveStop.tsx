import { useNavigate } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { canRemoveVisit } from '@/domain/visit'
import { useConfirm } from '@/ui/ConfirmDialog'
import type { Visit } from '@/features/workday/api/queries'
import { visitChanges } from '@/features/sync/changes'
import styles from './RemoveStop.module.scss'

interface RemoveStopProps {
  visit: Visit
  back: { to: '/s/workday'; search: { date?: string } }
}

/** Takes a stop the merchandiser added (or resumed) off the day, e.g. a wrong address. */
export function RemoveStop({ visit: v, back }: RemoveStopProps) {
  const navigate = useNavigate()
  const { confirm, dialog } = useConfirm()
  if (!canRemoveVisit(v)) return null

  const place = v.store.name ?? v.store.address
  const onRemove = async () => {
    const ok = await confirm({
      title: `¿Quitar ${place} de la jornada?`,
      description:
        v.workStatus === 'pending'
          ? 'Deja de aparecer en tu día. Si era una dirección cargada por error, podés volver a agregarla cuando quieras.'
          : 'Lo que cargaste en esta visita deja de contar en el día y en el informe.',
      confirmLabel: 'Quitar',
      tone: 'danger',
    })
    if (!ok) return
    await navigate(back) // leave first: on this phone the stop is gone at once
    await visitChanges(v).remove()
  }

  return (
    <div className={styles.remove}>
      <button type="button" className={styles.button} onClick={onRemove}>
        <Trash2 size={18} aria-hidden />
        Quitar de la jornada
      </button>
      <p className={styles.hint}>
        {v.resumedFrom ? 'Vuelve a quedar para retomar más adelante.' : 'Para direcciones cargadas por error o que ya no vas a visitar.'}
      </p>
      {dialog}
    </div>
  )
}
