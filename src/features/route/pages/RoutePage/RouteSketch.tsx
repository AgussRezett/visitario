import type { Point } from '@/domain/route'
import type { Visit } from '@/features/workday/api/queries'
import styles from './RoutePage.module.scss'

const W = 100
const PAD = 8

/**
 * A sketch of the route: the stops in order on a plain background. What shows when the
 * street map can't load (no signal, no WebGL).
 */
export function RouteSketch({ stops, origin }: { stops: Visit[]; origin: Point | null }) {
  const points = stops.map((v) => ({ lat: v.store.lat ?? 0, lng: v.store.lng ?? 0 }))
  const all = origin ? [origin, ...points] : points
  if (all.length < 2) return null
  const lats = all.map((p) => p.lat)
  const lngs = all.map((p) => p.lng)
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2
  // Longitude degrees shrink with latitude: keep distances true on screen.
  const sx = Math.cos((midLat * Math.PI) / 180)
  const spanX = Math.max((Math.max(...lngs) - Math.min(...lngs)) * sx, 1e-4)
  const spanY = Math.max(Math.max(...lats) - Math.min(...lats), 1e-4)
  const scale = (W - 2 * PAD) / Math.max(spanX, spanY)
  const h = Math.max(40, spanY * scale + 2 * PAD)
  const offX = (W - spanX * scale) / 2
  const offY = (h - spanY * scale) / 2
  const at = (p: Point) => ({ x: offX + (p.lng - Math.min(...lngs)) * sx * scale, y: offY + (Math.max(...lats) - p.lat) * scale })
  const xy = all.map(at)

  return (
    <div className={styles.map} style={{ aspectRatio: `${W} / ${h}` }} role="img" aria-label={`Croquis del recorrido: ${stops.length} locales en orden`}>
      <svg viewBox={`0 0 ${W} ${h}`} className={styles.mapSvg}>
        <polyline points={xy.map((p) => `${p.x},${p.y}`).join(' ')} className={styles.mapLine} />
        {origin ? <circle cx={xy[0]?.x} cy={xy[0]?.y} r={1.6} className={styles.mapOrigin} /> : null}
      </svg>
      {points.map((p, i) => {
        const q = at(p)
        return (
          <span key={stops[i]?.id} className={styles.mapPin} style={{ left: `${q.x}%`, top: `${(q.y / h) * 100}%` }}>{i + 1}</span>
        )
      })}
    </div>
  )
}
