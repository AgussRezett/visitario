import { Check, ImageIcon } from 'lucide-react'
import clsx from 'clsx'
import styles from './PhotoThumb.module.scss'

interface PhotoThumbProps {
  url: string | undefined
  caption?: string
  done?: boolean
  label: string
  onOpen: () => void
  className?: string
}

/** A photo tile; shows a placeholder while its signed URL loads. */
export function PhotoThumb({ url, caption, done, label, onOpen, className }: PhotoThumbProps) {
  return (
    <button type="button" className={clsx(styles.shot, className)} onClick={onOpen} aria-label={label}>
      {url ? <img src={url} alt="" className={styles.image} loading="lazy" /> : <ImageIcon className={styles.glyph} size={28} aria-hidden />}
      {done ? (
        <span className={styles.ok} aria-hidden>
          <Check size={14} strokeWidth={3} />
        </span>
      ) : null}
      {caption ? <span className={styles.caption}>{caption}</span> : null}
    </button>
  )
}
