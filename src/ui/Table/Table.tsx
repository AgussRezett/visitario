import type { ReactNode } from 'react'
import clsx from 'clsx'
import styles from './Table.module.scss'

/** Bordered data table for desktop screens; scrolls sideways when narrow. */
export function Table({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div className={clsx(styles.wrap, className)}>
      <table className={styles.table} aria-label={label}>{children}</table>
    </div>
  )
}
