import clsx from 'clsx'
import type { Size, Variant } from './Button'
import styles from './Button.module.scss'

/** The button look for a link (an <a> that opens Maps, say). */
export function buttonClass(variant: Variant = 'primary', size: Size = 'lg', className?: string) {
  return clsx(styles.button, styles[variant], styles[size], className)
}
