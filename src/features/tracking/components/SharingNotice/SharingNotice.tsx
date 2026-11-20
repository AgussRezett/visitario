import { LocateFixed, LocateOff } from 'lucide-react'
import clsx from 'clsx'
import { useSharingState } from '@/features/tracking/sharing'
import styles from './SharingNotice.module.scss'

/**
 * What the activador is told on their day: their supervisor sees where they are while the
 * day is under way, and what to do when the phone does not give its position.
 */
export function SharingNotice({ started }: { started: boolean }) {
  const state = useSharingState()
  if (state === 'denied' || state === 'unavailable') {
    return (
      <p className={clsx(styles.notice, styles.off)} role="status">
        <LocateOff size={16} aria-hidden />
        {state === 'denied'
          ? 'Tu celular no da permiso de ubicación: tu supervisor no ve tu recorrido. Activalo en los ajustes del navegador.'
          : 'No pudimos ver tu ubicación: tu supervisor no ve tu recorrido por ahora.'}
      </p>
    )
  }
  return (
    <p className={styles.notice} role="status">
      <LocateFixed size={16} aria-hidden />
      {state === 'sharing'
        ? 'Tu supervisor ve tu ubicación mientras la jornada está en curso.'
        : started ? 'Tu ubicación se comparte con tu supervisor solo con la jornada en curso.' : 'Cuando empieces la jornada, tu supervisor va a ver tu ubicación hasta que la termines.'}
    </p>
  )
}
