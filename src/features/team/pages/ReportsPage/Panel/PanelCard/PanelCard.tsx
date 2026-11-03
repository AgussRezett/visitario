import type { ReactNode } from 'react'
import clsx from 'clsx'
import styles from './PanelCard.module.scss'

/** A block of the reports panel: a title that says what it answers, and its content. */
export function PanelCard({ title, hint, aside, children, className, wide }: { title: string; hint?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <section className={clsx(styles.card, wide && styles.wide, className)} aria-label={title}>
      <header className={styles.head}>
        <div className={styles.titles}>
          <h2 className={styles.title}>{title}</h2>
          {hint ? <p className={styles.hint}>{hint}</p> : null}
        </div>
        {aside ? <div className={styles.aside}>{aside}</div> : null}
      </header>
      {children}
    </section>
  )
}
