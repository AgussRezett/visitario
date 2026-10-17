import { useConfirm } from '@/ui/ConfirmDialog'
import { useDismissResumable } from '@/features/workday/api/mutations'

/** Discarding pending visits from earlier days: one at a time, or all after asking. */
export function useDismissPending() {
  const dismiss = useDismissResumable()
  const { confirm, dialog } = useConfirm()
  const dismissAll = async (ids: string[]) => {
    const ok = await confirm({
      title: ids.length === 1 ? '¿Descartar la pendiente?' : `¿Descartar las ${ids.length} pendientes?`,
      description: 'No te las vamos a volver a ofrecer. Quedan en su día como no visitadas y tu supervisor las sigue viendo.',
      confirmLabel: 'Descartar',
      tone: 'danger',
    })
    if (ok) dismiss.mutate(ids)
  }
  return { dismissOne: (id: string) => dismiss.mutate([id]), dismissAll, dismissing: dismiss.isPending, error: dismiss.error, dialog }
}
