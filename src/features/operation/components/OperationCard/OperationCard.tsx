import { useState } from 'react'
import { ArrowDownToLine, DoorOpen, Flag, Map as MapIcon, UserPlus, Users } from 'lucide-react'
import { formatTime, todayInArgentina } from '@/domain/dates'
import { activeMembers, doingText, operationTitle, type Operation, type Presence } from '@/domain/operations'
import { PersonAvatar } from '@/features/people/PersonAvatar'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { useConfirm } from '@/ui/ConfirmDialog'
import { Switch } from '@/ui/Switch'
import type { Visit } from '@/features/workday/api/queries'
import { useOperationActions } from '@/features/operation/api'
import { setSharing, useSharing } from '@/features/operation/location'
import { CreateOperationSheet } from '@/features/operation/components/CreateOperationSheet'
import { AddPeopleSheet, BringSheet, TeamMapSheet } from './OperationSheets'
import styles from './OperationCard.module.scss'

interface OperationCardProps {
  companyId: string
  meId: string
  date: string
  op: Operation | null
  works: boolean
  isHost: boolean
  /** The operativo's stops (for the map and the place names). */
  stops: Visit[]
  /** My own pending stops outside the operativo: I can bring them in. */
  myPending: Visit[]
  presence: Presence[]
  locationError: string | null
}

type Open = 'create' | 'map' | 'add' | 'bring' | null

/** The day's operativo: who is in it and where, sharing location, and its actions. Or how to start one. */
export function OperationCard({ companyId, meId, date, op, works, isHost, stops, myPending, presence, locationError }: OperationCardProps) {
  const [open, setOpen] = useState<Open>(null)
  const { leave, end } = useOperationActions(companyId)
  const { confirm, dialog } = useConfirm()
  const sharing = useSharing(op && works ? op.id : null)

  if (!op) {
    if (date < todayInArgentina()) return null
    return (
      <section className={styles.invite} aria-label="Operativo">
        <span className={styles.icon} aria-hidden><Users size={20} /></span>
        <span className={styles.inviteText}>
          <span className={styles.title}>¿Salen juntos?</span>
          <span className={styles.meta}>Armá un operativo: trabajan los mismos locales y cada uno ve lo que hace el otro, en vivo.</span>
        </span>
        <Button variant="secondary" size="md" onClick={() => setOpen('create')}><Users size={18} aria-hidden />Armar operativo</Button>
        <CreateOperationSheet open={open === 'create'} onClose={() => setOpen(null)} companyId={companyId} date={date} meId={meId} />
      </section>
    )
  }

  const title = operationTitle(op, meId)
  const live = !op.endedAt
  const here = new Map(presence.map((p) => [p.personId, p]))
  const placeOf = (storeId: string) => {
    const v = stops.find((s) => s.store.id === storeId)
    return v ? v.store.name ?? v.store.address : null
  }
  const status = op.endedAt
    ? `Terminó a las ${formatTime(op.endedAt)}`
    : op.workdayStatus === 'draft'
      ? 'Sin publicar: tu supervisor lo está preparando'
      : `${op.visited} de ${op.total} ${op.total === 1 ? 'local' : 'locales'}${op.inProgress ? ` · ${op.inProgress} en curso` : ''}`

  const doLeave = async () => {
    if (await confirm({ title: '¿Salir del operativo?', description: 'Lo que hiciste queda en tu jornada. Dejás de ver los locales nuevos del equipo.', confirmLabel: 'Salir' })) leave.mutate(op.id)
  }
  const doEnd = async () => {
    if (await confirm({ title: '¿Terminar el operativo?', description: 'Los locales quedan en tu jornada y lo que hizo cada uno queda en la suya. Ya no se comparte la ubicación.', confirmLabel: 'Terminar' })) end.mutate(op.id)
  }

  return (
    <section className={styles.card} aria-label="Operativo">
      <div className={styles.head}>
        <span className={styles.icon} aria-hidden><Users size={20} /></span>
        <span className={styles.headText}>
          <span className={styles.eyebrow}>{live ? <><span className={styles.liveDot} aria-hidden />Operativo en vivo</> : 'Operativo'}</span>
          <span className={styles.title}>{title}</span>
          <span className={styles.meta}>{status}</span>
        </span>
      </div>

      <ul className={styles.members} aria-label="Integrantes">
        {activeMembers(op).map((m) => {
          const p = here.get(m.personId)
          const me = m.personId === meId
          return (
            <li key={m.personId} className={styles.member}>
              <span className={styles.avatar}>
                <PersonAvatar personId={m.personId} firstName={m.firstName} lastName={m.lastName} size={32} />
                {live ? <span className={styles.dot} data-on={Boolean(p) || undefined} aria-hidden /> : null}
              </span>
              <span className={styles.memberText}>
                <span className={styles.memberName}>{me ? 'Vos' : m.firstName}{m.personId === op.hostId ? <span className={styles.host}> · armó el operativo</span> : null}</span>
                {live ? <span className={styles.meta}>{p ? doingText(p, placeOf) : 'sin conexión'}</span> : null}
              </span>
            </li>
          )
        })}
      </ul>

      {works ? (
        <div className={styles.share}>
          <Switch checked={sharing} onChange={(on) => setSharing(op.id, on)}>
            Compartir mi ubicación
            <span className={styles.meta}>Solo con el operativo y tu supervisor, mientras la app está abierta. No se guarda.</span>
          </Switch>
          {sharing && locationError ? <Banner tone="warn">{locationError}</Banner> : null}
        </div>
      ) : null}

      <div className={styles.actions}>
        <Button variant="secondary" size="md" onClick={() => setOpen('map')}><MapIcon size={18} aria-hidden />Ver en el mapa</Button>
        {works ? <Button variant="secondary" size="md" onClick={() => setOpen('add')}><UserPlus size={18} aria-hidden />Sumar a alguien</Button> : null}
        {works && !isHost && myPending.length ? (
          <Button variant="secondary" size="md" onClick={() => setOpen('bring')}><ArrowDownToLine size={18} aria-hidden />{myPending.length === 1 ? 'Traer mi local' : `Traer mis ${myPending.length} locales`}</Button>
        ) : null}
        {works && isHost ? <Button variant="ghost" size="md" loading={end.isPending} onClick={() => void doEnd()}><Flag size={18} aria-hidden />Terminar operativo</Button> : null}
        {works && !isHost ? <Button variant="ghost" size="md" loading={leave.isPending} onClick={() => void doLeave()}><DoorOpen size={18} aria-hidden />Salir</Button> : null}
      </div>
      {leave.error ?? end.error ? <Banner tone="error">{(leave.error ?? end.error)?.message}</Banner> : null}

      <TeamMapSheet open={open === 'map'} onClose={() => setOpen(null)} title={title} stops={stops} people={presence} meId={meId} />
      {works ? <AddPeopleSheet open={open === 'add'} onClose={() => setOpen(null)} op={op} companyId={companyId} /> : null}
      {works && !isHost ? <BringSheet open={open === 'bring'} onClose={() => setOpen(null)} op={op} companyId={companyId} pending={myPending} /> : null}
      {dialog}
    </section>
  )
}
