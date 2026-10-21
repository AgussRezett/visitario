import { lazy, Suspense, useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownToLine, UserPlus } from 'lucide-react'
import { activeMembers, type Operation, type Presence } from '@/domain/operations'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import { Skeleton } from '@/ui/Skeleton'
import type { Visit } from '@/features/workday/api/queries'
import { teammatesQuery, useOperationActions } from '@/features/operation/api'
import { PeoplePicker } from '@/features/operation/components/PeoplePicker'
import styles from './OperationCard.module.scss'

const TeamMap = lazy(() => import('@/features/operation/components/TeamMap/TeamMap'))

/** The operativo on the map: its stops and who shares their location. */
export function TeamMapSheet({ open, onClose, title, stops, people, meId }: { open: boolean; onClose: () => void; title: string; stops: Visit[]; people: Presence[]; meId: string }) {
  return (
    <Sheet open={open} onClose={onClose} wide title={title} subtitle="Se actualiza en vivo. Solo se ve quien comparte su ubicación.">
      {open ? <Suspense fallback={<Skeleton height={340} />}><TeamMap stops={stops} people={people} meId={meId} /></Suspense> : null}
    </Sheet>
  )
}

/** Adding activadores to an open operativo. */
export function AddPeopleSheet({ open, onClose, op, companyId }: { open: boolean; onClose: () => void; op: Operation; companyId: string }) {
  const people = useQuery({ ...teammatesQuery(companyId), enabled: open })
  const { addMember } = useOperationActions(companyId)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) setSelected([])
    addMember.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- each opening starts empty
  }, [open])
  const inside = Object.fromEntries(activeMembers(op).map((m) => [m.personId, 'Ya está']))
  const add = async () => {
    setBusy(true)
    try {
      for (const personId of selected) await addMember.mutateAsync({ operationId: op.id, personId })
      onClose()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Sumar al operativo" subtitle="Ven y trabajan los mismos locales desde ahora."
      footer={<><Button variant="secondary" size="md" onClick={onClose} className={styles.cancel}>Cancelar</Button>
        <Button size="md" disabled={!selected.length} loading={busy} onClick={() => void add()}><UserPlus size={18} aria-hidden />Sumar {selected.length || ''}</Button></>}>
      <PeoplePicker label="Activadores" people={people.data ?? []} selected={selected} locked={inside}
        onToggle={(id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} />
      {addMember.error ? <Banner tone="error">{addMember.error.message}</Banner> : null}
    </Sheet>
  )
}

/** A member brings pending stops of their own day into the operativo. */
export function BringSheet({ open, onClose, op, companyId, pending }: { open: boolean; onClose: () => void; op: Operation; companyId: string; pending: Visit[] }) {
  const { bring } = useOperationActions(companyId)
  const [selected, setSelected] = useState<string[]>([])
  useEffect(() => {
    if (open) setSelected(pending.map((v) => v.id))
    bring.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- all chosen when it opens
  }, [open])
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  return (
    <Sheet open={open} onClose={onClose} title="Traer mis locales" subtitle="Pasan al operativo: el equipo los ve y cualquiera los hace. Salen de tu lista para no visitarlos dos veces."
      footer={<><Button variant="secondary" size="md" onClick={onClose} className={styles.cancel}>Cancelar</Button>
        <Button size="md" disabled={!selected.length} loading={bring.isPending} onClick={async () => { await bring.mutateAsync({ operationId: op.id, visitIds: selected }); onClose() }}>
          <ArrowDownToLine size={18} aria-hidden />Traer {selected.length || ''}</Button></>}>
      <ul className={styles.bringList} role="group" aria-label="Tus locales pendientes">
        {pending.map((v) => (
          <li key={v.id}>
            <button type="button" role="checkbox" aria-checked={selected.includes(v.id)} className={styles.bringRow} onClick={() => toggle(v.id)}>
              <span className={styles.bringCheck} data-on={selected.includes(v.id) || undefined} aria-hidden />
              <span className={styles.bringText}>
                <span className={styles.bringName}>{v.store.name ?? v.store.address}</span>
                {v.store.name ? <span className={styles.meta}>{v.store.address}</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {bring.error ? <Banner tone="error">{bring.error.message}</Banner> : null}
    </Sheet>
  )
}
