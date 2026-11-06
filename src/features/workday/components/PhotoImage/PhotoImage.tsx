import clsx from 'clsx'
import type { Crop } from '@/domain/crop'
import styles from './PhotoImage.module.scss'

/** What a photo needs to be shown cropped: its size and the part to show. */
export interface Framed {
  crop: Crop | null
  width: number
  height: number
}

interface PhotoImageProps {
  url: string
  frame?: Framed | null
  alt?: string
  /** `cover` fills the box (tiles), `contain` fits inside it (the viewer). */
  fit?: 'cover' | 'contain'
  className?: string
  lazy?: boolean
  onError?: () => void
}

/**
 * A photo as it should be seen: whole, or only its cropped part. The file is the same; an
 * SVG viewBox shows the part, so nothing is redrawn or downloaded twice.
 */
export function PhotoImage({ url, frame, alt = '', fit = 'cover', className, lazy, onError }: PhotoImageProps) {
  const c = frame?.crop
  if (!c || !frame?.width || !frame.height) {
    return <img src={url} alt={alt} className={className} loading={lazy ? 'lazy' : undefined} decoding="async" onError={onError} />
  }
  const { width: w, height: h } = frame
  return (
    <svg
      className={clsx(className, styles.cropped)}
      viewBox={`${c.x * w} ${c.y * h} ${c.w * w} ${c.h * h}`}
      preserveAspectRatio={fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      <image href={url} width={w} height={h} preserveAspectRatio="none" onError={onError} />
    </svg>
  )
}
