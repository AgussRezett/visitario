import type { ReactNode } from 'react'
import clsx from 'clsx'
import styles from './Banner.module.scss'

type Tone = 'info' | 'ok' | 'warn' | 'error'

export function Banner({ tone = 'info', title, children, icon }: { tone?: Tone; title?: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={clsx(styles.banner, styles[tone])}>
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      <div className={styles.content}>
        {title ? <p className={styles.title}>{title}</p> : null}
        {children ? <div className={styles.body}>{children}</div> : null}
      </div>
    </div>
  )
}
