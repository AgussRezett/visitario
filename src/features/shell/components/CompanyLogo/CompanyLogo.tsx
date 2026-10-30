import { useState } from 'react'
import clsx from 'clsx'
import { logoUrl } from '@/lib/avatars'
import styles from './CompanyLogo.module.scss'

/** The company's logo, at the height asked; nothing when it has none (or it does not load). */
export function CompanyLogo({ path, name, height = 32, className }: { path: string | null | undefined; name: string; height?: number; className?: string }) {
  const [broken, setBroken] = useState<string | null>(null)
  const src = logoUrl(path)
  if (!src || broken === src) return null
  return <img src={src} alt={name} className={clsx(styles.logo, className)} style={{ height }} onError={() => setBroken(src)} />
}
