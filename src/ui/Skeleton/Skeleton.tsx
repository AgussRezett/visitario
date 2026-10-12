import clsx from 'clsx'
import styles from './Skeleton.module.scss'

interface SkeletonProps {
  width?: number | string
  height?: number | string
  shape?: 'line' | 'round' | 'block'
  className?: string
}

/** Grey shape that stands in for content while it loads. Hidden from screen readers. */
export function Skeleton({ width = '100%', height = 14, shape = 'line', className }: SkeletonProps) {
  return <span aria-hidden className={clsx(styles.skeleton, shape !== 'line' && styles[shape], className)} style={{ width, height }} />
}
