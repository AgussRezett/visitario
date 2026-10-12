import type { ReactNode } from 'react'
import clsx from 'clsx'
import styles from './VisitSection.module.scss'

export type SectionState = 'ok' | 'todo' | 'warn'

interface VisitSectionProps {
  state: SectionState
  icon: ReactNode
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  children?: ReactNode
}

/** One block of the visit sheet: status square, title and its content. */
export function VisitSection({ state, icon, title, subtitle, action, children }: VisitSectionProps) {
  return (
    <section className={styles.section} aria-label={title}>
      <div className={styles.header}>
        <span className={clsx(styles.state, styles[state])} aria-hidden>{icon}</span>
        <span className={styles.titles}>
          <span className={styles.title}>{title}</span>
          {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
        </span>
        {action}
      </div>
      {children ? <div className={styles.body}>{children}</div> : null}
    </section>
  )
}
