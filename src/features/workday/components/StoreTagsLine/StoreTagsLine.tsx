import { BadgeDollarSign, Store } from 'lucide-react'
import clsx from 'clsx'
import type { StoreTags } from '@/features/workday/store-tags'
import styles from './StoreTagsLine.module.scss'

interface StoreTagsLineProps {
  tags: StoreTags
  /** Say "Sin canal" / "Sin vendedor" (supervisors and admins fill them). */
  showMissing?: boolean
  className?: string
}

/** The store's channel and seller, as two small labels. */
export function StoreTagsLine({ tags, showMissing, className }: StoreTagsLineProps) {
  if (!showMissing && !tags.channel && !tags.seller) return null
  return (
    <span className={clsx(styles.tags, className)}>
      {tags.channel || showMissing ? (
        <span className={styles.tag} data-missing={!tags.channel || undefined}>
          <Store size={14} aria-hidden />
          <span className={styles.text}>{tags.channel ?? 'Sin canal'}</span>
        </span>
      ) : null}
      {tags.seller || showMissing ? (
        <span className={styles.tag} data-missing={!tags.seller || undefined}>
          <BadgeDollarSign size={14} aria-hidden />
          <span className={styles.text}>{tags.seller ? `Vendedor: ${tags.seller}` : 'Sin vendedor'}</span>
        </span>
      ) : null}
    </span>
  )
}
