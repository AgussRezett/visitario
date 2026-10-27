import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Flag, Map as MapIcon, Users } from 'lucide-react'
import { formatTime } from '@/domain/dates'
import { activeMembers, doingText, operationTitle, type Operation } from '@/domain/operations'
import { PersonAvatar } from '@/features/people/PersonAvatar'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { useConfirm } from '@/ui/ConfirmDialog'
import { visitsQuery } from '@/features/workday/api/queries'
import { useOperationActions } from '@/features/operation/api'
import { useOperationPresence } from '@/features/operation/presence'
import { TeamMapSheet } from '@/features/operation/components/OperationCard/OperationSheets'
import styles from './OperationsBoard.module.scss'

/** The supervisor's view of the day's operativos: who, where and how far, live. */
export function OperationsBoard({ companyId, meId, ops }: { companyId: string; meId: string; ops: readonly Operation[] }) {
  if (!ops.length) return null
  return (
    <section className={styles.board} aria-label="Operativos">
      <h2 className={styles.heading}>Operativos · {ops.length}</h2>
      <div className={styles.cards}>
        {ops.map((op) => <OperationTeamCard key={op.id} op={op} companyId={companyId} meId={meId} />)}
      </div>
    </section>
  )
}

function OperationTeamCard({ op, companyId, meId }: { op: Operation; companyId: string; meId: string }) {
  const [mapOpen, setMapOpen] = useState(false)
  const live = !op.endedAt && op.workdayStatus !== 'draft'
  const presence = useOperationPresence(live ? op.id : null, null)
  const stops = useQuery({ ...visitsQuery(op.workdayId, meId), enabled: mapOpen || live })
  const { end } = useOperationActions(companyId)
  const { confirm, dialog } = useConfirm()
  const here = new Map(presence.map((p) => [p.personId, p]))
  const placeOf = (storeId: string) => {
    const v = (stops.data ?? []).find((s) => s.store.id === storeId)
    return v ? v.store.name ?? v.store.address : null
  }
  const title = operationTitle(op, meId)
  const share = op.total ? op.visited / op.total : 0

  return (
    <article className={styles.card} aria-label={title}>
      <div className={styles.head}>
        <span className={styles.icon} aria-hidden><Users size={18} /></span>
        <span className={styles.headText}>
          <span className={styles.title}>{title}</span>
          <span className={styles.meta}>
            {op.endedAt ? `Terminó a las ${formatTime(op.endedAt)}` : op.workdayStatus === 'draft' ? 'Sin publicar' : <><span className={styles.liveDot} aria-hidden />En vivo</>}
            {' · '}{op.visited} de {op.total}
          </span>
        </span>
      </div>
      <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={op.total} aria-valuenow={op.visited} aria-label={`Avance de ${title}`}>
        <i style={{ width: `${share * 100}%` }} />
      </div>
      <ul className={styles.members}>
        {activeMembers(op).map((m) => {
          const p = here.get(m.personId)
          return (
            <li key={m.personId} className={styles.member}>
              <span className={styles.avatar}>
                <PersonAvatar personId={m.personId} firstName={m.firstName} lastName={m.lastName} size={28} />
                {live ? <span className={styles.dot} data-on={Boolean(p) || undefined} aria-hidden /> : null}
              </span>
              <span className={styles.memberText}>
                <span className={styles.name}>{m.firstName}</span>
                {live ? <span className={styles.meta}>{p ? doingText(p, placeOf) : 'sin conexión'}</span> : null}
              </span>
            </li>
          )
        })}
      </ul>
      <div className={styles.actions}>
        <Button variant="secondary" size="md" onClick={() => setMapOpen(true)}><MapIcon size={18} aria-hidden />Ver en el mapa</Button>
        {!op.endedAt ? (
          <Button variant="ghost" size="md" loading={end.isPending}
            onClick={async () => { if (await confirm({ title: '¿Terminar el operativo?', description: 'Lo que hizo cada uno queda en su jornada.', confirmLabel: 'Terminar' })) end.mutate(op.id) }}>
            <Flag size={18} aria-hidden />Terminar
          </Button>
        ) : null}
      </div>
      {end.error ? <Banner tone="error">{end.error.message}</Banner> : null}
      <TeamMapSheet open={mapOpen} onClose={() => setMapOpen(false)} title={title} stops={stops.data ?? []} people={presence} meId={meId} />
      {dialog}
    </article>
  )
}
