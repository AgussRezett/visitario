import { Link } from '@tanstack/react-router'
import { History, Navigation } from 'lucide-react'
import { formatDayMonth } from '@/domain/dates'
import { mapsSearchUrl } from '@/domain/places'
import { levelOf, RAPPORT_SHORT } from '@/domain/reputation'
import { recencyOf, RECENCY_COLOR, RECENCY_LABEL, type MapPoint } from '@/domain/store-map'
import { buttonClass } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import styles from './PointSheet.module.scss'

interface PointSheetProps {
  point: MapPoint | null
  today: string
  channel: string | null
  seller: string | null
  /** A seller opens their client's page; supervisors and admins, the directory's. */
  asSeller: boolean
  onClose: () => void
}

/** A tapped balloon: who it is, when it was last activated and where to go from here. */
export function PointSheet({ point: p, today, channel, seller, asSeller, onClose }: PointSheetProps) {
  if (!p) return null
  const { band, days } = recencyOf(p, today)
  const last = p.lastVisitDate
    ? `${formatDayMonth(p.lastVisitDate, true)}${p.lastMerchandiser ? ` · ${p.lastMerchandiser}` : ''}${days !== null ? ` · ${days === 0 ? 'hoy' : `hace ${days} ${days === 1 ? 'día' : 'días'}`}` : ''}`
    : 'Nunca activado'
  const facts: { label: string; value: string }[] = [
    { label: 'Última activación', value: last },
    { label: 'Activaciones', value: `${p.visits30} en 30 días · ${p.visits90} en 90 días` },
    { label: 'Trato', value: p.rapport === null ? 'Sin calificar' : RAPPORT_SHORT[levelOf(p.rapport)] },
    { label: 'Canal', value: channel ?? 'Sin canal' },
    ...(asSeller ? [] : [{ label: 'Vendedor', value: seller ?? 'Sin vendedor' }]),
  ]

  return (
    <Sheet open onClose={onClose} title={p.name ?? p.address} subtitle={[p.name ? p.address : null, p.area, p.customerNumber && `Cliente ${p.customerNumber}`].filter(Boolean).join(' · ')}>
      <div className={styles.body}>
        <p className={styles.band}>
          <span className={styles.dot} style={{ background: RECENCY_COLOR[band] }} aria-hidden />
          {RECENCY_LABEL[band]}
        </p>
        <dl className={styles.facts}>
          {facts.map((f) => (
            <div key={f.label} className={styles.fact}>
              <dt className={styles.label}>{f.label}</dt>
              <dd className={styles.value}>{f.value}</dd>
            </div>
          ))}
        </dl>
        <div className={styles.actions}>
          {asSeller ? (
            <Link to="/s/clients/$storeId" params={{ storeId: p.id }} className={buttonClass('primary', 'lg', styles.action)}>
              <History size={20} aria-hidden />Ver ficha e historial
            </Link>
          ) : (
            <Link to="/stores/$storeId" params={{ storeId: p.id }} className={buttonClass('primary', 'lg', styles.action)}>
              <History size={20} aria-hidden />Ver ficha e historial
            </Link>
          )}
          <a href={mapsSearchUrl(p)} target="_blank" rel="noreferrer" className={buttonClass('secondary', 'md', styles.action)}>
            <Navigation size={18} aria-hidden />Abrir en Google Maps
          </a>
        </div>
      </div>
    </Sheet>
  )
}
