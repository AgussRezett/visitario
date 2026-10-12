import { Camera, Check } from 'lucide-react'
import { formatTime } from '@/domain/dates'
import type { Visit } from '@/features/workday/api/queries'
import { PhotoPicker } from '@/features/workday/components/PhotoPicker'
import { PhotoThumb } from '@/features/workday/components/PhotoThumb'
import { VisitSection } from '@/features/workday/components/VisitSection'
import styles from './ArrivalSection.module.scss'

interface ArrivalSectionProps {
  visit: Visit
  busy: boolean
  urlFor: (id: string) => string | undefined
  onArrive: (file: File) => void
  onView: (photoId: string) => void
}

/** Arrival is the storefront photo; no location is recorded. */
export function ArrivalSection({ visit: v, busy, urlFor, onArrive, onView }: ArrivalSectionProps) {
  const storefront = v.photos.filter((p) => p.kind === 'storefront')
  const first = storefront[0]
  const arrived = Boolean(first)
  return (
    <VisitSection
      state={arrived ? 'ok' : 'todo'}
      icon={arrived ? <Check size={16} strokeWidth={3} /> : <Camera size={16} />}
      title="Llegada y fachada"
      subtitle={first ? `${formatTime(v.arrivedAt ?? first.takenAt)} con la foto de fachada` : 'Al llegar, sacá la foto de la fachada'}
    >
      <div className={styles.photos}>
        {storefront.map((p) => (
          <PhotoThumb key={p.id} url={urlFor(p.id)} caption="Fachada" done label="Ver la foto de la fachada" onOpen={() => onView(p.id)} className={styles.thumb} />
        ))}
        {!arrived ? (
          <PhotoPicker className={styles.arrive} onPick={onArrive} disabled={busy} label="Marcar llegada con la foto de la fachada">
            <Camera size={20} aria-hidden />
            {busy ? 'Subiendo la foto…' : 'Marcar llegada'}
          </PhotoPicker>
        ) : null}
        <span className={styles.hint}>Desde la computadora podés elegir la foto de tus archivos o arrastrarla.</span>
      </div>
    </VisitSection>
  )
}
