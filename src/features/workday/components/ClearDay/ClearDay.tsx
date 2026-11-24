import { Eraser } from 'lucide-react'
import { canClear } from '@/domain/visit'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { useConfirm } from '@/ui/ConfirmDialog'
import type { Visit } from '@/features/workday/api/queries'
import { useClearWorkday } from '@/features/workday/api/mutations'
import { useOnline } from '@/lib/online'
import styles from './ClearDay.module.scss'

interface ClearDayProps {
  workdayId: string
  visits: readonly Visit[]
  /** A supervisor or admin clears any stop; the activador, the ones they added. */
  boss: boolean
  /** Whose day, to say it: "tu jornada", "la jornada de Lucía". */
  whose: string
  className?: string
}

/**
 * "Limpiar jornada": when a route was passed by mistake, every stop not started yet goes in
 * one step, after confirming. What was started, visited or has photos stays.
 */
export function ClearDay({ workdayId, visits, boss, whose, className }: ClearDayProps) {
  const clear = useClearWorkday(workdayId)
  const online = useOnline()
  const { confirm, dialog } = useConfirm()
  const n = visits.filter((v) => canClear(v, boss)).length
  if (n < 2) return null
  const stays = visits.length - n

  const onClear = async () => {
    const ok = await confirm({
      title: `¿Limpiar ${whose}?`,
      description: [
        `Se quitan los ${n} locales que todavía no se empezaron.`,
        stays ? `${stays === 1 ? 'Queda 1 que ya tiene' : `Quedan ${stays} que ya tienen`} algo cargado${boss ? '' : ' o los asignó tu supervisor'}.` : '',
        'Si era otro recorrido, después agregás el que corresponde.',
      ].filter(Boolean).join(' '),
      confirmLabel: `Quitar ${n} locales`,
      tone: 'danger',
    })
    if (ok) clear.mutate()
  }

  return (
    <div className={className}>
      <Button variant="secondary" size="md" className={styles.button} onClick={() => void onClear()} disabled={!online} loading={clear.isPending}>
        <Eraser size={18} aria-hidden />Limpiar jornada
      </Button>
      {!online ? <p className={styles.hint}>Necesitás conexión para limpiar la jornada.</p> : null}
      {clear.error ? <Banner tone="error">{clear.error.message}</Banner> : null}
      {dialog}
    </div>
  )
}
