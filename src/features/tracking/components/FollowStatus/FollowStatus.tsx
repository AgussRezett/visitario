import { LocateFixed, LocateOff } from 'lucide-react'
import clsx from 'clsx'
import styles from './FollowStatus.module.scss'

interface FollowStatusProps {
  first: string
  /** Today: followed live. Another day: the path they walked. */
  live: boolean
  /** "hace 2 min", or null when no position came. */
  seen: string | null
  stale: boolean
  otherPhones: number
}

/** Over the activador's map: how fresh their position is, or why there is none. */
export function FollowStatus({ first, live, seen, stale, otherPhones }: FollowStatusProps) {
  if (!seen) {
    return (
      <p className={clsx(styles.status, styles.none)}>
        <LocateOff size={16} aria-hidden />
        {live ? `${first} todavía no compartió su ubicación hoy. Aparece cuando empieza la jornada con la app abierta.` : `No hay recorrido de ${first} ese día.`}
      </p>
    )
  }
  return (
    <p className={clsx(styles.status, stale && styles.none)} role="status">
      <LocateFixed size={16} aria-hidden />
      {live ? `${stale ? 'Última ubicación' : 'Ubicación'} de ${first}: ${seen}` : `El recorrido que hizo ${first}`}
      {live && otherPhones ? ` · también conectado desde ${otherPhones === 1 ? 'otro teléfono' : `${otherPhones} teléfonos más`}` : ''}
    </p>
  )
}
