import { useNavigate } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { canRemoveVisit } from '@/domain/visit'
import { Banner } from '@/ui/Banner'
import type { Visit } from '@/features/workday/api/queries'
import { useRemoveVisit } from '@/features/workday/api/mutations'
import styles from './RemoveStop.module.scss'

interface RemoveStopProps {
  visit: Visit
  back: { to: '/s/workday'; search: { date?: string } }
}

/** Takes a stop the merchandiser added (or resumed) off the day, e.g. a wrong address. */
export function RemoveStop({ visit: v, back }: RemoveStopProps) {
  const navigate = useNavigate()
  const remove = useRemoveVisit(v.id)
  if (!canRemoveVisit(v)) return null

  const place = v.store.name ?? v.store.address
  const onRemove = async () => {
    const question =
      v.workStatus === 'pending'
        ? `¿Quitar ${place} de la jornada?`
        : `¿Quitar ${place} de la jornada? Lo que cargaste en esta visita deja de contar en el día y en el informe.`
    if (!window.confirm(question)) return
    try {
      await remove.mutateAsync()
      await navigate(back)
    } catch {
      // the banner shows the error
    }
  }

  return (
    <div className={styles.remove}>
      {remove.error ? <Banner tone="error">{remove.error.message}</Banner> : null}
      <button type="button" className={styles.button} onClick={onRemove} disabled={remove.isPending}>
        <Trash2 size={18} aria-hidden />
        {remove.isPending ? 'Quitando…' : 'Quitar de la jornada'}
      </button>
      <p className={styles.hint}>
        {v.resumedFrom ? 'Vuelve a quedar para retomar más adelante.' : 'Para direcciones cargadas por error o que ya no vas a visitar.'}
      </p>
    </div>
  )
}
