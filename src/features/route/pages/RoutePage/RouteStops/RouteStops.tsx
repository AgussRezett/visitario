import { useState } from 'react'
import { GripVertical, Navigation } from 'lucide-react'
import clsx from 'clsx'
import { directionsUrl, placeQuery, type TravelMode } from '@/domain/route'
import { STOP_TONE_LABEL, stopTone, type StopTone } from '@/domain/visit'
import { buttonClass } from '@/ui/Button'
import { StatusChip } from '@/ui/StatusChip'
import type { Visit } from '@/features/workday/api/queries'
import { placeName, stopNote } from '../stop'
import { useDragOrder } from './useDragOrder'
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
  /** Ordering by hand: a handle on each stop to drag it (or move it with the arrow keys). */
  onReorder?: (ids: string[]) => void
}

/**
 * The route's stops in order, each in the color of how it is going. A store already
 * visited stays in its place, marked, instead of leaving the route.
 */
export function RouteStops({ stops, mode, lastId, onReorder }: RouteStopsProps) {
  const tones = new Set(stops.map((v) => stopTone(v.workStatus, v.reviewStatus)))
  const ids = stops.map((v) => v.id)
  const reorder = onReorder && stops.length > 1 ? onReorder : undefined
  // Said out loud after each move, for screen readers.
  const [said, setSaid] = useState('')
  const move = (next: string[], moved: string) => {
    reorder?.(next)
    const v = stops.find((s) => s.id === moved)
    if (v) setSaid(`${placeName(v)}, ahora ${next.indexOf(moved) + 1} de ${next.length}`)
  }
  const { drag, handle, ref } = useDragOrder(ids, reorder ? move : undefined)
  return (
    <div className={styles.card}>
      <ol className={styles.order} aria-label="Locales en el orden del recorrido">
        {stops.map((v, i) => {
          const tone = stopTone(v.workStatus, v.reviewStatus)
          const dragging = drag?.id === v.id
          return (
            <li key={v.id} ref={ref(v.id)} className={styles.stop} data-tone={tone} data-dragging={dragging || undefined}
              style={dragging ? { transform: `translateY(${drag.dy}px)` } : undefined}>
              {reorder ? (
                <button type="button" className={styles.grip} {...handle(v.id, placeName(v))}>
                  <GripVertical size={18} aria-hidden />
                </button>
              ) : null}
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
      {reorder ? <p className={styles.hidden} aria-live="polite">{said}</p> : null}
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
