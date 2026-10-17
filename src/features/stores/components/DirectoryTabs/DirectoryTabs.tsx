import { Link } from '@tanstack/react-router'
import styles from './DirectoryTabs.module.scss'

/** The directory's two views: the stores, and how they receive the merchandisers. */
export function DirectoryTabs({ view }: { view: 'stores' | 'reputation' }) {
  return (
    <nav className={styles.tabs} aria-label="Vistas del directorio">
      <Link to="/s/stores" search={{}} className={styles.tab} aria-current={view === 'stores' ? 'page' : undefined}>Comercios</Link>
      <Link to="/s/stores" search={{ view: 'reputation' }} className={styles.tab} aria-current={view === 'reputation' ? 'page' : undefined}>Reputación</Link>
    </nav>
  )
}
