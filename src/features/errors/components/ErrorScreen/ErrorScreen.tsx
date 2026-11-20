import { useEffect, useMemo, useState } from 'react'
import { Home, MessageSquareWarning, RotateCcw, TriangleAlert } from 'lucide-react'
import { Button } from '@/ui/Button'
import { describeError } from '@/features/errors/report'
import { isOffline, isStaleVersion, reloadForUpdate } from '@/features/errors/chunk'
import { ReportForm } from '@/features/errors/components/ReportForm'
import styles from './ErrorScreen.module.scss'

interface ErrorScreenProps {
  error: unknown
  /** Tries the screen again; without it, the page reloads. */
  onRetry?: () => void
}

/** A screen that broke: say it plainly, offer a way out, and let the person report it. */
export function ErrorScreen({ error, onRetry }: ErrorScreenProps) {
  const described = useMemo(() => describeError(error), [error])
  // No signal is not a bug: nothing to report, only to try again (and no reload without signal).
  const offline = isOffline(error)
  const stale = !offline && isStaleVersion(error)
  const [reloading, setReloading] = useState(false)
  const [reporting, setReporting] = useState(false)

  // An old version asking for screens that no longer exist: get the new one, once.
  useEffect(() => {
    if (stale && reloadForUpdate()) setReloading(true)
  }, [stale])

  if (reloading) return <p className={styles.updating} role="status">Actualizando Visitario…</p>

  return (
    <div className={styles.screen}>
      <div className={styles.card} role="alert">
        <span className={styles.icon}><TriangleAlert size={24} aria-hidden /></span>
        <h1 className={styles.title}>{stale ? 'Hay una versión nueva' : offline ? 'Sin conexión' : 'Algo salió mal'}</h1>
        <p className={styles.lead}>
          {stale
            ? 'Esta pantalla cambió con la última actualización. Recargá para usar la versión nueva.'
            : offline
              ? 'No pudimos conectarnos para abrir esta pantalla. Revisá la señal y reintentá. Lo que cargaste sigue guardado en el teléfono.'
              : 'Esta pantalla tuvo un problema. Lo que cargaste y lo que falta enviar sigue guardado en el teléfono.'}
        </p>
        <div className={styles.actions}>
          <Button size="lg" onClick={() => (onRetry && !stale ? onRetry() : location.reload())}>
            <RotateCcw size={18} aria-hidden />
            {stale ? 'Recargar' : 'Reintentar'}
          </Button>
          <Button variant="secondary" size="lg" onClick={() => location.assign('/')}>
            <Home size={18} aria-hidden />
            Ir al inicio
          </Button>
        </div>

        {offline ? null : <div className={styles.report}>
          {reporting ? (
            <ReportForm kind="crash" error={described} />
          ) : (
            <Button variant="ghost" size="md" onClick={() => setReporting(true)}>
              <MessageSquareWarning size={18} aria-hidden />
              Reportar el problema
            </Button>
          )}
        </div>}

        <details className={styles.details}>
          <summary>Detalle técnico</summary>
          <code className={styles.code}>{described.message}</code>
        </details>
      </div>
    </div>
  )
}
