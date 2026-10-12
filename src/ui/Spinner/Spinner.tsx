import styles from './Spinner.module.scss'

export function FullScreenSpinner({ label = 'Cargando' }: { label?: string }) {
  return (
    <div className={styles.screen} role="status">
      <span className={styles.ring} aria-hidden />
      <span className={styles.srOnly}>{label}</span>
    </div>
  )
}
