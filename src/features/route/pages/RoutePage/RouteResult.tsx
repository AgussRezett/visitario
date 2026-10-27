import { Suspense } from 'react'
import { ArrowLeft, Check, Map as MapIcon, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { formatTime } from '@/domain/dates'
import { MAPS_STOPS, inRoute, mapsLegs, placeQuery, type Point, type TravelMode } from '@/domain/route'
import { Button, buttonClass } from '@/ui/Button'
import type { Visit } from '@/features/workday/api/queries'
import { RouteSketch } from './RouteSketch'
import { RouteStops } from './RouteStops'
import { StreetMap } from './StreetMap'
import styles from './RoutePage.module.scss'

export interface RoutePlan {
  ids: string[]
  km: number
  /** Only by streets. */
  minutes: number | null
  byStreet: boolean
  /** The path by streets as [lng, lat], when the service sent it. */
  line: [number, number][] | null
}

interface RouteResultProps {
  plan: RoutePlan | null
  /** Every stop of the day: those of the route keep their place and show how they are going. */
  visits: Visit[]
  mode: TravelMode
  origin: Point | null
  /** It started at the phone (a saved route keeps only that, never where). */
  fromOrigin: boolean
  lastId: string
  refining: boolean
  /** When it was calculated, for a route kept from before. */
  savedAt: string | null
  /** Nothing left to order: the kept route is only shown. */
  canRecalculate: boolean
  onBack: () => void
  onRecalculate: () => void
  onApply: () => void
}

const km = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** The suggested order, the Maps legs and applying it to the day (wireframes A08, AD08). */
export function RouteResult({ plan, visits, mode, origin, fromOrigin, lastId, refining, savedAt, canRecalculate, onBack, onRecalculate, onApply }: RouteResultProps) {
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
  const left = stops.filter(inRoute)
  // Closed ones are still to come back to: only those out of the route count as done.
  const done = stops.length - left.length
  // Stores added after it was calculated (with a location, so they could be in it).
  const outside = visits.filter((v) => inRoute(v) && v.store.lat !== null && v.store.lng !== null && !plan.ids.includes(v.id)).length
  const legs = mapsLegs(left.map((v) => placeQuery(v.store)), mode, origin ?? undefined, MAPS_STOPS)
  const how = [
    `${stops.length} ${stops.length === 1 ? 'local' : 'locales'}`,
    mode === 'driving' ? 'en auto' : 'a pie',
    origin || fromOrigin ? 'desde tu ubicación' : 'desde el primer local',
    savedAt ? `calculado ${formatTime(savedAt)}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <section className={styles.resultBody} aria-label="Orden sugerido">
      <div className={styles.appbar}>
        {canRecalculate ? <button type="button" className={styles.iconButton} onClick={onBack} aria-label="Volver a las opciones"><ArrowLeft size={22} aria-hidden /></button> : null}
        <span className={styles.appbarText}>
          <span className={styles.cardTitle}>Recorrido sugerido</span>
          <span className={styles.help}>{how}</span>
        </span>
        {canRecalculate ? <button type="button" className={styles.iconButton} onClick={onRecalculate} aria-label="Recalcular con los que quedan"><RefreshCw size={20} aria-hidden /></button> : null}
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
        {done ? (
          <>
            <span className={styles.rule} aria-hidden />
            <span className={styles.figure}><b>{done}/{stops.length}</b><span>{done === stops.length ? 'todos hechos' : 'hechos'}</span></span>
          </>
        ) : null}
      </div>
      {outside ? <p className={styles.help}>{outside === 1 ? 'Sumaste 1 local después de calcularlo: recalculá para ubicarlo.' : `Sumaste ${outside} locales después de calcularlo: recalculá para ubicarlos.`}</p> : null}

      <Suspense fallback={<RouteSketch stops={stops} origin={origin} />}>
        <StreetMap key={`${plan.ids.join(',')}:${plan.line?.length ?? 0}:${origin ? 'o' : ''}:${stops.map((v) => v.workStatus + v.reviewStatus).join()}`} stops={stops} origin={origin} line={plan.line} mode={mode} progress />
      </Suspense>

      <RouteStops stops={stops} mode={mode} lastId={lastId} />

      {left.length ? (
        <div className={styles.footer}>
          <Button onClick={onApply}><Check size={20} aria-hidden />Aplicar este orden a mi jornada</Button>
        </div>
      ) : null}

      {legs.length ? <span className={styles.eyebrow}>Abrir en Google Maps{done ? ' · los que quedan' : ''}</span> : null}
      <div className={styles.legs}>
        {legs.map((leg, i) => (
          <a key={leg.href} className={buttonClass('secondary', 'sm', styles.leg)} href={leg.href} target="_blank" rel="noreferrer">
            <MapIcon size={16} aria-hidden />{legs.length === 1 ? 'Todo el recorrido' : `Tramo ${i + 1} · ${leg.from} a ${leg.to}`}
          </a>
        ))}
      </div>
      <p className={styles.help} hidden={!legs.length}>
        {legs.length > 1 ? `Google Maps admite hasta ${MAPS_STOPS} paradas por vez: abrí los tramos en orden.` : 'Se abre en la app de Google Maps con todas las paradas.'}
      </p>

    </section>
  )
}
