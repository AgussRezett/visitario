import clsx from 'clsx'
import styles from './AppVersion.module.scss'

const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0'
const COMMIT = typeof __APP_COMMIT__ === 'string' ? __APP_COMMIT__ : ''

/** "Visitario v2.1.0": which version is open, to tell support or check an update arrived. */
export function AppVersion({ className }: { className?: string }) {
  return (
    <p className={clsx(styles.version, className)} title={COMMIT ? `Versión ${APP_VERSION} · ${COMMIT}` : `Versión ${APP_VERSION}`}>
      Visitario <span className={styles.number}>v{APP_VERSION}</span>
    </p>
  )
}
