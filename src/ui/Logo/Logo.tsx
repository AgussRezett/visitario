import clsx from 'clsx'
import styles from './Logo.module.scss'

/** Visitario wordmark: the V with a lime square reads as a ticked box. */
export function Logo({ size = 'md', onDark = false, className }: { size?: 'md' | 'lg'; onDark?: boolean; className?: string }) {
  const mark = size === 'lg' ? 40 : 28
  return (
    <span className={clsx(styles.logo, styles[size], className)}>
      <svg width={mark} height={mark} viewBox="0 0 32 32" aria-hidden>
        <path d="M3 5h6.5L16 22.5 22.5 5H29L19.2 28h-6.4z" fill={onDark ? '#F6F7F2' : 'currentColor'} className={onDark ? undefined : styles.mark} />
        <rect x="22.5" y="1" width="8" height="8" rx="2" fill="#B8D941" />
      </svg>
      <span className={onDark ? styles.onDark : styles.word}>isitario</span>
      <span className={styles.srOnly}>Visitario</span>
    </span>
  )
}
