import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Team } from '@/domain/people'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { useConfirm } from '@/ui/ConfirmDialog'
import { Field } from '@/ui/Field'
import { Sheet } from '@/ui/Sheet'
import { useAdminPeople } from '@/features/admin/api/people'
import styles from './TeamSheet.module.scss'

/** New team, or rename one and its areas; removing it leaves its people without a team. */
export function TeamSheet({ team, companyId, onClose }: { team: Team | 'new' | null; companyId: string; onClose: () => void }) {
  const { saveTeam, removeTeam } = useAdminPeople(companyId)
  const { confirm, dialog } = useConfirm()
  const [name, setName] = useState('')
  const [areas, setAreas] = useState('')
  const existing = team && team !== 'new' ? team : null

  useEffect(() => {
    setName(existing?.name ?? '')
    setAreas(existing?.areas ?? '')
    saveTeam.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when another team opens
  }, [team])

  if (!team) return null
  const save = async () => {
    await saveTeam.mutateAsync({ id: existing?.id, name: name.trim(), areas: areas.trim() || null })
    onClose()
  }
  const remove = async () => {
    if (!existing) return
    const ok = await confirm({ title: `¿Borrar ${existing.name}?`, description: 'Sus activadores y su supervisor quedan sin equipo hasta que les asignes otro.', confirmLabel: 'Borrar equipo', tone: 'danger' })
    if (!ok) return
    await removeTeam.mutateAsync(existing.id)
    onClose()
  }
  const error = saveTeam.error ?? removeTeam.error

  return (
    <Sheet
      open
      onClose={onClose}
      title={existing ? `Editar ${existing.name}` : 'Nuevo equipo'}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} className={styles.cancel}>Cancelar</Button>
          <Button size="md" disabled={!name.trim()} loading={saveTeam.isPending} onClick={save}>{existing ? 'Guardar' : 'Crear equipo'}</Button>
        </>
      }
    >
      <Field label="Nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ej.: Equipo Norte" autoFocus />
      <Field label="Zonas" value={areas} onChange={(e) => setAreas(e.target.value)} maxLength={200} placeholder="Ej.: Belgrano, Colegiales" help="Opcional: para reconocer el equipo de un vistazo." />
      {error ? <Banner tone="error">{error.message}</Banner> : null}
      {existing ? (
        <Button variant="ghost" size="sm" onClick={remove} loading={removeTeam.isPending} className={styles.remove}>
          <Trash2 size={16} aria-hidden />Borrar equipo
        </Button>
      ) : null}
      {dialog}
    </Sheet>
  )
}
