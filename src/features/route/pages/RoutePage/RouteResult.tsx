import { ArrowLeft, Check, Map as MapIcon, Navigation, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { directionsUrl, mapsLegs, placeQuery, type Point, type TravelMode } from '@/domain/route'
import { Button, buttonClass } from '@/ui/Button'
import type { Visit } from '@/features/workday/api/queries'
import { placeName, stopNote } from './stop'
import { RouteMap } from './RouteMap'
import styles from './RoutePage.module.scss'

export interface RoutePlan {
  ids: string[]
  km: number
  /** Only by streets. */
  minutes: number | null
  byStreet: boolean
}

interface RouteResultProps {
  plan: RoutePlan | null
  visits: Visit[]
  mode: TravelMode
  origin: Point | null
  lastId: string
  /** Stores per Google Maps leg: 4 on a phone (3 in between), 10 on a computer. */
  perLeg: number
  refining: boolean
  onBack: () => void
  onRecalculate: () => void
  onApply: () => void
}

const km = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** The suggested order, the Maps legs and applying it to the day (wireframes A08, AD08). */
export function RouteResult({ plan, visits, mode, origin, lastId, perLeg, refining, onBack, onRecalculate, onApply }: RouteResultProps) {
  if (!plan) {
    return (
      <section className={clsx(styles.card, styles.waiting)} aria-label="Orden sugerido">
        <MapIcon size={28} aria-hidden className={styles.waitingIcon} />
        <p className={styles.cardTitle}>Elegí cómo vas y calculá el mejor orden</p>
        <p className={styles.help}>Vas a ver el recorrido, cuánto lleva y los tramos para abrir en Google Maps.</p>
      </section>
    )
  }

  const byId = new Map(visits.map((v) => [v.id, v]))
  const stops = plan.ids.flatMap((id) => byId.get(id) ?? [])
  const legs = mapsLegs(stops.map((v) => placeQuery(v.store)), mode, origin ?? undefined, perLeg)
  const how = `${stops.length} ${stops.length === 1 ? 'local' : 'locales'} · ${mode === 'driving' ? 'en auto' : 'a pie'} · ${origin ? 'desde tu ubicación' : 'desde el primer local'}`

  return (
    <section className={styles.resultBody} aria-label="Orden sugerido">
      <div className={styles.appbar}>
        <button type="button" className={styles.iconButton} onClick={onBack} aria-label="Volver a las opciones"><ArrowLeft size={22} aria-hidden /></button>
        <span className={styles.appbarText}>
          <span className={styles.cardTitle}>Recorrido sugerido</span>
          <span className={styles.help}>{how}</span>
        </span>
        <button type="button" className={styles.iconButton} onClick={onRecalculate} aria-label="Recalcular"><RefreshCw size={20} aria-hidden /></button>
      </div>

      <div className={styles.summary} aria-live="polite">
        <span className={styles.figure}>
          <b>{km(plan.km)} km</b>
          <span>{plan.byStreet ? 'por calles' : refining ? 'en línea recta · buscando por calles…' : 'en línea recta'}</span>
        </span>
        {plan.minutes !== null ? (
          <>
            <span className={styles.rule} aria-hidden />
            <span className={styles.figure}><b>{plan.minutes} min</b><span>de traslado, sin tiempo en locales</span></span>
          </>
        ) : null}
      </div>

      <RouteMap stops={stops} origin={origin} />

      <div className={styles.orderCard}>
        <ol className={styles.order}>
          {stops.map((v, i) => (
            <li key={v.id} className={styles.stop}>
              <span className={clsx(styles.num, i === 0 && styles.numFirst)}>{i + 1}</span>
              <span className={styles.stopText}>
                <span className={styles.choiceName}>{placeName(v)}{v.id === lastId && i === stops.length - 1 && stops.length > 1 ? ' · último' : ''}</span>
                <span className={styles.choiceNote}>{stopNote(v)}</span>
              </span>
              <a className={buttonClass('secondary', 'sm', styles.go)} href={directionsUrl(placeQuery(v.store), mode)} target="_blank" rel="noreferrer" aria-label={`Ir a ${placeName(v)}`}>
                <Navigation size={16} aria-hidden />Ir
              </a>
            </li>
          ))}
        </ol>
      </div>

      <span className={styles.eyebrow}>Abrir en Google Maps</span>
      <div className={styles.legs}>
        {legs.map((leg, i) => (
          <a key={leg.href} className={buttonClass('secondary', 'sm', styles.leg)} href={leg.href} target="_blank" rel="noreferrer">
            <MapIcon size={16} aria-hidden />{legs.length === 1 ? 'Todo el recorrido' : `Tramo ${i + 1} · ${leg.from} a ${leg.to}`}
          </a>
        ))}
      </div>
      <p className={styles.help}>
        {legs.length > 1 ? 'Google Maps admite pocas paradas por vez: abrí los tramos en orden.' : 'En el celular el recorrido se divide en tramos de 3 paradas.'}
      </p>

      <div className={styles.footer}>
        <Button onClick={onApply}><Check size={20} aria-hidden />Aplicar este orden a mi jornada</Button>
      </div>
    </section>
  )
}
