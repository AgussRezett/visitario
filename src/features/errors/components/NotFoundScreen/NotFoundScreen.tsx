import { Home, MapPinOff } from 'lucide-react'
import { Button } from '@/ui/Button'
import styles from '@/features/errors/components/ErrorScreen/ErrorScreen.module.scss'

/** A link to a screen that does not exist (an old bookmark, a typo). */
export function NotFoundScreen() {
  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <span className={styles.icon}><MapPinOff size={24} aria-hidden /></span>
        <h1 className={styles.title}>No encontramos esta pantalla</h1>
        <p className={styles.lead}>El enlace puede ser viejo o tener un error. Volvé al inicio para seguir.</p>
        <div className={styles.actions}>
          <Button size="lg" onClick={() => location.assign('/')}>
            <Home size={18} aria-hidden />
            Ir al inicio
          </Button>
        </div>
      </div>
    </div>
  )
}
