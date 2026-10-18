import clsx from 'clsx'
import { LOGO_VIEWBOX, MARK_TRANSFORM, SQUARE, V_LEFT, V_RIGHT, WORD } from './paths'
import styles from './Logo.module.scss'

/** Visitario logo: the V with the lime square (a ticked box) and "isitario", drawn as shapes. */
export function Logo({ size = 'md', onDark = false, className }: { size?: 'md' | 'lg'; onDark?: boolean; className?: string }) {
  return (
    <svg viewBox={LOGO_VIEWBOX} className={clsx(styles.logo, styles[size], onDark && styles.onDark, className)} role="img" aria-label="Visitario">
      <g transform={MARK_TRANSFORM}>
        <path className={styles.square} d={SQUARE} />
        <path className={styles.ink} d={V_LEFT} />
        <path className={styles.ink} d={V_RIGHT} />
      </g>
      <path className={styles.ink} d={WORD} />
    </svg>
  )
}
