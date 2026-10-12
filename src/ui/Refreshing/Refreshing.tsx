import type { ReactNode } from 'react'
import clsx from 'clsx'
import styles from './Refreshing.module.scss'

interface RefreshingProps {
  /** True while the content shown belongs to the previous selection (another date, another filter). */
  active: boolean
  children: ReactNode
  className?: string
}

/**
 * Keeps what is on screen while the next data arrives, slightly faded, instead of
 * swapping it for a skeleton. Skeletons are only for the very first load.
 */
export function Refreshing({ active, children, className }: RefreshingProps) {
  return (
    <div className={clsx(styles.refreshing, active && styles.active, className)} aria-busy={active || undefined}>
      {children}
    </div>
  )
}
