import { AlertTriangle, Check, CloudUpload, ImageIcon } from 'lucide-react'
import clsx from 'clsx'
import { useUploadState } from '@/features/sync/hooks'
import { PhotoImage, type Framed } from '@/features/workday/components/PhotoImage'
import styles from './PhotoThumb.module.scss'

interface PhotoThumbProps {
  /** To show whether the photo is still uploading or failed. */
  photoId?: string
  url: string | undefined
  /** The photo's size and crop, to show only the cropped part. */
  frame?: Framed | null
  caption?: string
  done?: boolean
  label: string
  onOpen: () => void
  className?: string
}

/** A photo tile; shows a placeholder while its signed URL loads and a badge while it uploads. */
export function PhotoThumb({ photoId, url, frame, caption, done, label, onOpen, className }: PhotoThumbProps) {
  const state = useUploadState(photoId)
  const fullLabel = state === 'failed' ? `${label} (no se pudo subir)` : state === 'uploading' ? `${label} (subiendo)` : label
  return (
    <button type="button" className={clsx(styles.shot, className)} onClick={onOpen} aria-label={fullLabel}>
      {url ? <PhotoImage url={url} frame={frame} className={styles.image} lazy /> : <ImageIcon className={styles.glyph} size={28} aria-hidden />}
      {state === 'failed' ? (
        <span className={styles.failed} aria-hidden>
          <AlertTriangle size={14} strokeWidth={2.5} />
        </span>
      ) : state === 'uploading' ? (
        <span className={styles.uploading} aria-hidden>
          <CloudUpload size={14} strokeWidth={2.5} />
        </span>
      ) : done ? (
        <span className={styles.ok} aria-hidden>
          <Check size={14} strokeWidth={3} />
        </span>
      ) : null}
      {caption ? <span className={styles.caption}>{caption}</span> : null}
    </button>
  )
}
