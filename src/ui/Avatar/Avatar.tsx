import clsx from 'clsx'
import styles from './Avatar.module.scss'

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  return (
    <span aria-hidden className={clsx(styles.avatar, className)} style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      {name}
    </span>
  )
}
