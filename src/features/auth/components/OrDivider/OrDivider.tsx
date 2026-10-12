import styles from './OrDivider.module.scss'

export function OrDivider({ label }: { label: string }) {
  return (
    <div className={styles.divider}>
      <span className={styles.line} />
      {label}
      <span className={styles.line} />
    </div>
  )
}
