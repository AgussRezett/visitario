import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { formatLongDate } from '@/domain/dates'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Select } from '@/ui/Select'
import { Sheet } from '@/ui/Sheet'
import { teammatesQuery, useOperationActions } from '@/features/operation/api'
import { PeoplePicker } from '@/features/operation/components/PeoplePicker'
import styles from './CreateOperationSheet.module.scss'

interface CreateOperationSheetProps {
  open: boolean
  onClose: () => void
  companyId: string
  date: string
  /** An activador shares their own day; without it (a supervisor) someone is chosen to host. */
  meId: string | null
  onCreated?: (operationId: string) => void
}

/** Going out together: who, and (optionally) a name for the operativo. */
export function CreateOperationSheet({ open, onClose, companyId, date, meId, onCreated }: CreateOperationSheetProps) {
  const people = useQuery({ ...teammatesQuery(companyId), enabled: open })
  const { create } = useOperationActions(companyId)
  const [selected, setSelected] = useState<string[]>([])
  const [host, setHost] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    if (!open) return
    setSelected([])
    setHost('')
    setName('')
    create.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- each opening starts empty
  }, [open])

  const others = (people.data ?? []).filter((p) => p.personId !== meId)
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const chosenHost = meId ?? (selected.includes(host) ? host : selected[0] ?? '')
  const ready = meId ? selected.length >= 1 : selected.length >= 2
  const nameOf = (id: string) => {
    const p = people.data?.find((x) => x.personId === id)
    return p ? `${p.firstName} ${p.lastName}` : ''
  }

  const submit = async () => {
    const id = await create.mutateAsync({ date, members: selected, host: meId ? undefined : chosenHost, name })
    onCreated?.(id)
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Armar operativo"
      subtitle={formatLongDate(date)}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} className={styles.cancel}>Cancelar</Button>
          <Button size="md" disabled={!ready} loading={create.isPending} onClick={() => void submit()}>
            <Users size={18} aria-hidden />{selected.length ? `Armar con ${meId ? selected.length : selected.length - 1} ${(meId ? selected.length : selected.length - 1) === 1 ? 'compañero' : 'compañeros'}` : 'Armar operativo'}
          </Button>
        </>
      }
    >
      <p className={styles.lead}>
        {meId
          ? 'Tus locales de ese día pasan a ser del operativo: tus compañeros los ven y los trabajan con vos, en vivo. Lo que hagan cuenta en la jornada de cada uno.'
          : 'Los locales de quien encabeza son los del operativo. Queda sin publicar hasta que publiques las jornadas de ese día.'}
      </p>
      <PeoplePicker label={meId ? 'Compañeros' : 'Activadores'} people={meId ? others : people.data ?? []} selected={selected} onToggle={toggle} />
      {!meId && selected.length >= 2 ? (
        <Select label="Encabeza" value={chosenHost} onChange={(e) => setHost(e.target.value)}
          options={selected.map((id) => ({ value: id, label: nameOf(id) }))} />
      ) : null}
      <Field label="Nombre" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Opcional: Ej. Coto Cabildo" />
      {people.error ? <Banner tone="error">No pudimos cargar los activadores. Revisá la conexión.</Banner> : null}
      {create.error ? <Banner tone="error">{create.error.message}</Banner> : null}
    </Sheet>
  )
}
