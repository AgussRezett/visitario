import { useState } from 'react'
import { useConfirm } from '@/ui/ConfirmDialog'
import { openStopsCount, useArchiveStore } from '@/features/stores/api/stores'

interface Target { id: string; label: string }

const stopsText = (n: number) =>
  n === 1 ? 'Tiene 1 parada pendiente en una jornada de hoy en adelante: se quita de esa jornada.'
    : `Tiene ${n} paradas pendientes en jornadas de hoy en adelante: se quitan de esas jornadas.`

/** Archive, restore and remove a store, with the confirmations they need (directory and store page). */
export function useStoreArchive() {
  const { archive, remove } = useArchiveStore()
  const { confirm, dialog } = useConfirm()
  const [counting, setCounting] = useState<string | null>(null)

  const askArchive = async (s: Target) => {
    setCounting(s.id)
    const stops = await openStopsCount(s.id).catch(() => 0)
    setCounting(null)
    const ok = await confirm({
      title: `¿Archivar ${s.label}?`,
      description: [
        'Sale del directorio y de las búsquedas para agregar o importar.',
        stops ? stopsText(stops) : null,
        'Las visitas hechas quedan en el historial y lo podés restaurar desde "Archivados".',
      ].filter(Boolean).join(' '),
      confirmLabel: 'Archivar',
      tone: 'danger',
    })
    if (ok) archive.mutate({ id: s.id, archived: true })
  }

  const askRemove = async (s: Target) => {
    const ok = await confirm({
      title: `¿Eliminar ${s.label}?`,
      description: 'Sale de "Archivados" y no se puede restaurar. Sus visitas siguen en el historial y en los informes, con su dirección.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (ok) remove.mutate(s.id)
  }

  const restore = (id: string) => archive.mutate({ id, archived: false })
  /** The store an action is running on, to show it on its button. */
  const busy = counting ?? (archive.isPending ? archive.variables.id : remove.isPending ? remove.variables : null)

  return { askArchive, askRemove, restore, busy, error: archive.error ?? remove.error, dialog }
}
