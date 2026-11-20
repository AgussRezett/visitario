import { LocateFixed, LocateOff, Navigation } from 'lucide-react'
import clsx from 'clsx'
import { formatTime } from '@/domain/dates'
import { agoText } from '@/domain/team'
import type { Whereabouts } from '@/domain/tracking'
import styles from './FollowStatus.module.scss'

interface FollowStatusProps {
  first: string
  /** Today: followed live. Another day: the path they walked. */
  live: boolean
  /** The phone sent its position in the last 5 minutes: "hace 2 min". */
  fresh: string | null
  /** Where they are in the day, from their stops. */
  where: Whereabouts | null
  otherPhones: number
  /** Another day: whether there is any path to show. */
  hasPath: boolean
  now: Date
}

/**
 * Over the activador's map: where they are. The phone only sends with the app open, so
 * between stops (the app in a pocket) it says where they are headed and since when.
 */
export function FollowStatus({ first, live, fresh, where, otherPhones, hasPath, now }: FollowStatusProps) {
  if (!live) {
    return (
      <p className={clsx(styles.status, !hasPath && styles.none)}>
        {hasPath ? <LocateFixed size={16} aria-hidden /> : <LocateOff size={16} aria-hidden />}
        {hasPath ? `El recorrido que hizo ${first}` : `No hay recorrido de ${first} ese día.`}
      </p>
    )
  }
  const phones = otherPhones ? ` · también conectado desde ${otherPhones === 1 ? 'otro teléfono' : `${otherPhones} teléfonos más`}` : ''
  if (fresh) {
    return (
      <p className={styles.status} role="status">
        <LocateFixed size={16} aria-hidden />
        {`Ubicación de ${first}: ${fresh}${where?.kind === 'at' ? ` · en ${where.place}` : ''}${phones}`}
      </p>
    )
  }
  if (where?.kind === 'between') {
    return (
      <p className={styles.status} role="status">
        <Navigation size={16} aria-hidden />
        {`En camino a ${where.to.name} · salió de ${where.from} ${agoText(where.left, now)}`}
      </p>
    )
  }
  return (
    <p className={clsx(styles.status, where?.kind !== 'at' && styles.none)} role="status">
      {where?.kind === 'at' ? <LocateFixed size={16} aria-hidden /> : <LocateOff size={16} aria-hidden />}
      {where?.kind === 'at'
        ? `${first} está en ${where.place}${where.since ? ` desde las ${formatTime(where.since)}` : ''}`
        : where?.kind === 'done'
          ? `${first} terminó la jornada.`
          : `${first} todavía no empezó la jornada. Su ubicación aparece cuando llega al primer local.`}
    </p>
  )
}
