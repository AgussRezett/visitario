import { useConfirm } from '@/ui/ConfirmDialog'
import { useDismissResumable } from '@/features/workday/api/mutations'

/** Discarding the chosen pending visits, after asking. Resolves whether they were discarded. */
export function useDismissPending() {
  const dismiss = useDismissResumable()
  const { confirm, dialog } = useConfirm()
  const dismissChosen = async (ids: string[]) => {
    if (!ids.length) return false
    const ok = await confirm({
      title: ids.length === 1 ? '¿Descartar 1 pendiente?' : `¿Descartar ${ids.length} pendientes?`,
      description: 'No te las vamos a volver a ofrecer. Quedan en su día como no visitadas y tu supervisor las sigue viendo.',
      confirmLabel: 'Descartar',
    })
    if (!ok) return false
    await dismiss.mutateAsync(ids)
    return true
  }
  return { dismissChosen, dismissing: dismiss.isPending, error: dismiss.error, dialog }
}
