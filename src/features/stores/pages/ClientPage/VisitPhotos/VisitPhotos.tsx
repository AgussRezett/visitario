import { useState } from 'react'
import type { Photo } from '@/features/workday/api/queries'
import { PhotoThumb } from '@/features/workday/components/PhotoThumb'
import { PhotoViewer } from '@/features/workday/components/PhotoViewer'
import type { ClientVisit } from '@/features/storemap/api'
import styles from './VisitPhotos.module.scss'

interface VisitPhotosProps {
  visit: ClientVisit
  title: string
  urlFor: (id: string) => string | undefined
}

/** The "después" of an activation: how the client's shelf was left. Tap to see them big. */
export function VisitPhotos({ visit: v, title, urlFor }: VisitPhotosProps) {
  const [open, setOpen] = useState<string | null>(null)
  if (!v.photos.length) return null
  const photos: Photo[] = v.photos.map((p) => ({ ...p, kind: 'after', displayId: null, takenAt: v.date, uploaded: true }))
  return (
    <>
      <div className={styles.strip} aria-label="Fotos del después">
        {photos.map((p, i) => (
          <PhotoThumb key={p.id} url={urlFor(p.id)} frame={p} label={`Después ${i + 1} de ${photos.length}`} onOpen={() => setOpen(p.id)} className={styles.thumb} />
        ))}
      </div>
      {open ? <PhotoViewer photos={photos} startId={open} title={title} subtitle="Después" urlFor={urlFor} onClose={() => setOpen(null)} /> : null}
    </>
  )
}
