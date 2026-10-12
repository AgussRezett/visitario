import { Camera, Check } from 'lucide-react'
import clsx from 'clsx'
import type { Visit } from '@/features/workday/api/queries'
import { PhotoPicker } from '@/features/workday/components/PhotoPicker'
import styles from './PhotoStrip.module.scss'

interface PhotoStripProps {
  visit: Visit
  working: boolean
  busy: boolean
  onArrive: (file: File) => void
  onViewStorefront: () => void
  onDisplayPhoto: (kind: 'before' | 'after') => void
}

/** Phone shortcut row: storefront, before, after (wireframe A09). */
export function PhotoStrip({ visit: v, working, busy, onArrive, onViewStorefront, onDisplayPhoto }: PhotoStripProps) {
  const hasStorefront = v.photos.some((p) => p.kind === 'storefront')
  const all = (kind: 'before' | 'after') => v.displays.length > 0 && v.displays.every((d) => v.photos.some((p) => p.displayId === d.id && p.kind === kind))
  const canDisplays = working && v.displays.length > 0

  return (
    <div className={styles.strip}>
      {hasStorefront ? (
        <button type="button" className={clsx(styles.cam, styles.done)} onClick={onViewStorefront}>
          <Check size={22} strokeWidth={3} aria-hidden />Fachada
        </button>
      ) : (
        <PhotoPicker className={styles.cam} onPick={onArrive} disabled={busy} label="Sacar la foto de la fachada">
          <Camera size={22} aria-hidden />{busy ? 'Subiendo…' : 'Fachada'}
        </PhotoPicker>
      )}
      {(['before', 'after'] as const).map((kind) => (
        <button key={kind} type="button" className={clsx(styles.cam, all(kind) && styles.done)} disabled={!canDisplays} onClick={() => onDisplayPhoto(kind)}>
          {all(kind) ? <Check size={22} strokeWidth={3} aria-hidden /> : <Camera size={22} aria-hidden />}
          {kind === 'before' ? 'Antes' : 'Después'}
        </button>
      ))}
    </div>
  )
}
