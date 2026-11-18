import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Camera, Cloud, Crop as CropIcon, Download, RefreshCw, Share2, Trash2, X, Clock } from 'lucide-react'
import type { Crop } from '@/domain/crop'
import { formatTime } from '@/domain/dates'
import { canShare, share } from '@/lib/share'
import { useConfirm } from '@/ui/ConfirmDialog'
import type { Photo } from '@/features/workday/api/queries'
import { localPhotoBlob, photoFile } from '@/features/workday/api/photos'
import { croppedBlob } from '@/features/workday/api/crop-file'
import { useUploadState } from '@/features/sync/hooks'
import { useOnline } from '@/lib/online'
import { PhotoPicker } from '@/features/workday/components/PhotoPicker'
import { CropSheet } from '@/features/workday/components/CropSheet'
import { PhotoImage } from '@/features/workday/components/PhotoImage'
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
  onRetry?: (photo: Photo) => void
  /** Who may crop gets "Recortar"; null shows the photo whole again. */
  onCrop?: (photo: Photo, crop: Crop | null) => unknown
  /** The photo as it is now (its crop may have changed since the viewer opened). */
  latest?: (id: string) => Photo | undefined
  /** Each photo's own title, when the photos are of different displays ("1 Primaria · antes"). */
  captionFor?: (photo: Photo) => string | undefined
}

// A horizontal drag this long (px), more sideways than down, moves to the next or previous photo.
const SWIPE = 48

/** Full-screen viewer for the photos of a visit or a display (wireframes A15 / AD12). */
export function PhotoViewer({ photos, startId, title: fallbackTitle, subtitle, urlFor, onClose, onReplace, onDelete, onRetry, onCrop, latest, captionFor }: PhotoViewerProps) {
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

  const { confirm, dialog } = useConfirm()
  const listed = photos[index]
  const photo = (listed && latest?.(listed.id)) ?? listed
  const url = photo ? urlFor(photo.id) : undefined
  const [cropping, setCropping] = useState(false)
  const [saving, setSaving] = useState(false)
  const title = (listed && captionFor?.(listed)) || fallbackTitle
  const many = photos.length > 1
  const move = (step: number) => setIndex((i) => (i + step + photos.length) % photos.length)

  // Swiping on the phone: a sideways drag moves; the tap that ends it is not a second move.
  const start = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  const onPointerDown = (e: PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY }
    swiped.current = false
  }
  const onPointerUp = (e: PointerEvent) => {
    const from = start.current
    start.current = null
    if (!from || !many) return
    const dx = e.clientX - from.x
    if (Math.abs(dx) < SWIPE || Math.abs(dx) < Math.abs(e.clientY - from.y)) return
    swiped.current = true
    move(dx < 0 ? 1 : -1)
  }
  const tap = (step: number) => () => {
    if (swiped.current) swiped.current = false
    else move(step)
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (!many || cropping) return
    if (e.key === 'ArrowRight') move(1)
    else if (e.key === 'ArrowLeft') move(-1)
  }
  const uploadState = useUploadState(photo?.id)
  const failed = uploadState === 'failed'
  const online = useOnline()
  const saveCrop = async (crop: Crop | null) => {
    if (!photo || !onCrop) return
    setSaving(true)
    try {
      await onCrop(photo, crop)
      setCropping(false)
    } finally {
      setSaving(false)
    }
  }

  const sharePhoto = async () => {
    if (!photo) return
    // The bucket's links can be shown but not read: the bytes come through the photos function.
    const whole = localPhotoBlob(photo.id) ?? (url ? await photoFile(photo.id).catch(() => null) : null)
    const blob = whole ? await croppedBlob(whole, photo.crop).catch(() => whole) : null
    const files = blob ? [new File([blob], `${title}.jpg`, { type: 'image/jpeg' })] : undefined
    await share({ title, text: subtitle, files })
  }

  return (
    <dialog ref={ref} className={styles.viewer} aria-label={title} onKeyDown={onKeyDown} onClose={(e) => e.target === e.currentTarget && onClose()}>
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
          <div className={styles.stage} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { start.current = null }}>
            {many ? <button type="button" className={styles.prev} aria-label="Foto anterior" onClick={tap(-1)} /> : null}
            {url ? <PhotoImage url={url} frame={photo} fit="contain" alt={`${title}, foto ${index + 1}`} className={styles.image} /> : <span className={styles.loading}>Cargando…</span>}
            {many ? <button type="button" className={styles.next} aria-label="Foto siguiente" onClick={tap(1)} /> : null}
          </div>
          {many ? (
            <div className={styles.dots} aria-hidden>
              {photos.map((p, i) => (
                <span key={p.id} className={i === index ? styles.dotOn : styles.dot} />
              ))}
            </div>
          ) : null}
          <div className={styles.meta}>
            <span className={styles.chip}><Clock size={14} aria-hidden />{formatTime(photo.takenAt)}</span>
            <span className={styles.chip}><Cloud size={14} aria-hidden />{failed ? 'No se pudo subir' : uploadState === 'uploading' ? (online ? 'Subiendo…' : 'Guardada en el celu · sube con señal') : 'Guardada en el servidor'}</span>
          </div>
          <div className={styles.actions}>
            {failed && onRetry ? (
              <button type="button" className={styles.action} onClick={() => onRetry(photo)}>
                <RefreshCw size={22} aria-hidden />Reintentar
              </button>
            ) : null}
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
            {onCrop && url ? (
              <button type="button" className={styles.action} onClick={() => setCropping(true)}>
                <CropIcon size={22} aria-hidden />Recortar
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
                onClick={async () => {
                  const lastStorefront = photo.kind === 'storefront' && photos.filter((p) => p.kind === 'storefront').length === 1
                  const ok = await confirm(
                    lastStorefront
                      ? {
                          title: '¿Borrar la foto de la fachada?',
                          description: 'La parada vuelve a quedar pendiente: se borran la hora de llegada y la respuesta del local. Las exhibiciones y sus fotos se mantienen.',
                          confirmLabel: 'Borrar fachada',
                          tone: 'danger',
                        }
                      : { title: '¿Borrar esta foto?', description: 'No se puede recuperar.', confirmLabel: 'Borrar', tone: 'danger' },
                  )
                  if (ok) onDelete(photo)
                }}
              >
                <Trash2 size={22} aria-hidden />Borrar
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {dialog}
      {onCrop ? <CropSheet open={cropping && Boolean(photo)} url={url} photo={photo ?? null} title={title} saving={saving} onClose={() => setCropping(false)} onSave={(c) => void saveCrop(c)} /> : null}
    </dialog>
  )
}
