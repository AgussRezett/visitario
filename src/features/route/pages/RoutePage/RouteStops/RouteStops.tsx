import { Navigation } from 'lucide-react'
import clsx from 'clsx'
import { directionsUrl, placeQuery, type TravelMode } from '@/domain/route'
import { STOP_TONE_LABEL, stopTone, type StopTone } from '@/domain/visit'
import { buttonClass } from '@/ui/Button'
import { StatusChip } from '@/ui/StatusChip'
import type { Visit } from '@/features/workday/api/queries'
import { placeName, stopNote } from '../stop'
import styles from './RouteStops.module.scss'

const NUM: Record<StopTone, string | undefined> = {
  pending: undefined,
  active: styles.active,
  done: styles.done,
  approved: styles.done,
  fix: styles.fix,
  closed: styles.closed,
  refused: styles.refused,
}

interface RouteStopsProps {
  stops: Visit[]
  mode: TravelMode
  lastId: string
}

/**
 * The route's stops in order, each in the color of how it is going. A store already
 * visited stays in its place, marked, instead of leaving the route.
 */
export function RouteStops({ stops, mode, lastId }: RouteStopsProps) {
  const tones = new Set(stops.map((v) => stopTone(v.workStatus, v.reviewStatus)))
  return (
    <div className={styles.card}>
      <ol className={styles.order} aria-label="Locales en el orden del recorrido">
        {stops.map((v, i) => {
          const tone = stopTone(v.workStatus, v.reviewStatus)
          return (
            <li key={v.id} className={styles.stop} data-tone={tone}>
              <span className={clsx(styles.num, NUM[tone])}>{i + 1}</span>
              <span className={styles.text}>
                <span className={styles.name}>{placeName(v)}{v.id === lastId && i === stops.length - 1 && stops.length > 1 ? ' · último' : ''}<span className={styles.hidden}>, {STOP_TONE_LABEL[tone]}</span></span>
                <span className={styles.note}>{stopNote(v)}</span>
              </span>
              {tone === 'pending' || tone === 'active' || tone === 'closed' ? (
                <a className={buttonClass('secondary', 'sm', styles.go)} href={directionsUrl(placeQuery(v.store), mode)} target="_blank" rel="noreferrer" aria-label={`Ir a ${placeName(v)}`}>
                  <Navigation size={16} aria-hidden />Ir
                </a>
              ) : (
                <StatusChip work={v.workStatus} review={v.reviewStatus} />
              )}
            </li>
          )
        })}
      </ol>
      {tones.size > 1 || !tones.has('pending') ? (
        <p className={styles.legend}>
          {(['pending', 'active', 'done', 'fix', 'closed', 'refused'] as const)
            .filter((t) => tones.has(t) || (t === 'done' && tones.has('approved')))
            .map((t) => <span key={t} className={styles.key}><span className={clsx(styles.dot, NUM[t])} aria-hidden />{STOP_TONE_LABEL[t].split(',')[0]}</span>)}
        </p>
      ) : null}
    </div>
  )
}
