import { useEffect, useRef, useState } from 'react'
import { Camera, Cloud, Download, Share2, Trash2, X, Clock } from 'lucide-react'
import { formatTime } from '@/domain/dates'
import { canShare, share } from '@/lib/share'
import type { Photo } from '@/features/workday/api/queries'
import { localPhotoBlob } from '@/features/workday/api/photos'
import { PhotoPicker } from '@/features/workday/components/PhotoPicker'
import styles from './PhotoViewer.module.scss'

interface PhotoViewerProps {
  photos: Photo[]
  startId: string | null
  title: string
  subtitle: string
  urlFor: (id: string) => string | undefined
  onClose: () => void
  onReplace?: (photo: Photo, file: File) => void
  onDelete?: (photo: Photo) => void
}

/** Full-screen viewer for the photos of a visit or a display (wireframes A15 / AD12). */
export function PhotoViewer({ photos, startId, title, subtitle, urlFor, onClose, onReplace, onDelete }: PhotoViewerProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const [index, setIndex] = useState(0)
  const open = startId !== null

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open) {
      setIndex(Math.max(0, photos.findIndex((p) => p.id === startId)))
      if (!dialog.open) dialog.showModal?.()
    } else if (dialog.open) dialog.close?.()
  }, [open, startId, photos])

  const photo = photos[index]
  const url = photo ? urlFor(photo.id) : undefined

  const sharePhoto = async () => {
    if (!photo) return
    const blob = localPhotoBlob(photo.id) ?? (url ? await fetch(url).then((r) => r.blob()).catch(() => null) : null)
    const files = blob ? [new File([blob], `${title}.jpg`, { type: 'image/jpeg' })] : undefined
    await share({ title, text: subtitle, files })
  }

  return (
    <dialog ref={ref} className={styles.viewer} aria-label={title} onClose={onClose}>
      {open && photo ? (
        <div className={styles.frame}>
          <div className={styles.bar}>
            <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Cerrar">
              <X size={22} aria-hidden />
            </button>
            <div className={styles.titles}>
              <span className={styles.title}>{title}</span>
              <span className={styles.subtitle}>Foto {index + 1} de {photos.length} · {subtitle}</span>
            </div>
          </div>
          <div className={styles.stage}>
            {photos.length > 1 ? <button type="button" className={styles.prev} aria-label="Foto anterior" onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)} /> : null}
            {url ? <img src={url} alt={`${title}, foto ${index + 1}`} className={styles.image} /> : <span className={styles.loading}>Cargando…</span>}
            {photos.length > 1 ? <button type="button" className={styles.next} aria-label="Foto siguiente" onClick={() => setIndex((i) => (i + 1) % photos.length)} /> : null}
          </div>
          {photos.length > 1 ? (
            <div className={styles.dots} aria-hidden>
              {photos.map((p, i) => (
                <span key={p.id} className={i === index ? styles.dotOn : styles.dot} />
              ))}
            </div>
          ) : null}
          <div className={styles.meta}>
            <span className={styles.chip}><Clock size={14} aria-hidden />{formatTime(photo.takenAt)}</span>
            <span className={styles.chip}><Cloud size={14} aria-hidden />{photo.uploaded ? 'Guardada en el servidor' : 'Subiendo…'}</span>
          </div>
          <div className={styles.actions}>
            {url ? (
              <a className={styles.action} href={url} target="_blank" rel="noreferrer" download>
                <Download size={22} aria-hidden />Guardar
              </a>
            ) : null}
            {canShare() ? (
              <button type="button" className={styles.action} onClick={sharePhoto}>
                <Share2 size={22} aria-hidden />Compartir
              </button>
            ) : null}
            {onReplace ? (
              <PhotoPicker className={styles.action} onPick={(file) => onReplace(photo, file)}>
                <Camera size={22} aria-hidden />Reemplazar
              </PhotoPicker>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                className={styles.danger}
                onClick={() => {
                  const lastStorefront = photo.kind === 'storefront' && photos.filter((p) => p.kind === 'storefront').length === 1
                  const question = lastStorefront
                    ? '¿Borrar la foto de la fachada? La parada vuelve a quedar pendiente: se borran la hora de llegada y la respuesta del local. Las exhibiciones y sus fotos se mantienen.'
                    : '¿Borrar esta foto?'
                  if (window.confirm(question)) onDelete(photo)
                }}
              >
                <Trash2 size={22} aria-hidden />Borrar
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
