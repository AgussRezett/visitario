import type { ReactNode } from 'react'
import clsx from 'clsx'
import styles from './Switch.module.scss'

/** On / off with its label on the left; the whole row is the target. */
export function Switch({ checked, onChange, children, disabled, className }: { checked: boolean; onChange: (on: boolean) => void; children: ReactNode; disabled?: boolean; className?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} className={clsx(styles.row, className)} onClick={() => onChange(!checked)}>
      <span className={styles.label}>{children}</span>
      <span className={styles.track} aria-hidden><span className={styles.thumb} /></span>
    </button>
  )
}
