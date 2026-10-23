import { useState } from 'react'
import clsx from 'clsx'
import styles from './Avatar.module.scss'

interface AvatarProps {
  /** Initials, shown while there is no photo or it does not load. */
  name: string
  size?: number
  /** The person's photo, when they have one. */
  src?: string | null
  className?: string
}

export function Avatar({ name, size = 32, src, className }: AvatarProps) {
  const [broken, setBroken] = useState<string | null>(null)
  const photo = src && broken !== src ? src : null
  return (
    <span aria-hidden className={clsx(styles.avatar, className)} style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      {photo ? <img src={photo} alt="" className={styles.photo} loading="lazy" decoding="async" onError={() => setBroken(photo)} /> : name}
    </span>
  )
}
