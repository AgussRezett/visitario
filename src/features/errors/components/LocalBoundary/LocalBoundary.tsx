import { Component, useState, type ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/ui/Button'
import { describeError, sendReport } from '@/features/errors/report'
import { isStaleVersion, reloadForUpdate } from '@/features/errors/chunk'
import styles from './LocalBoundary.module.scss'

interface LocalBoundaryProps {
  /** What broke, to say it: "el mapa", "las fotos". */
  what: string
  children: ReactNode
}

/**
 * A part of a screen that can fail on its own (a map, a viewer): if it breaks, only that part
 * says so, small, and the rest of the screen keeps working. The full error screen is for
 * whole screens that cannot show.
 */
export class LocalBoundary extends Component<LocalBoundaryProps, { error: unknown }> {
  override state: { error: unknown } = { error: null }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  override componentDidCatch(error: unknown) {
    // An old version asking for code that is gone: get the new one (once).
    if (isStaleVersion(error)) reloadForUpdate()
  }

  override render() {
    const { error } = this.state
    if (!error) return this.props.children
    return <Failed what={this.props.what} error={error} onRetry={() => this.setState({ error: null })} />
  }
}

function Failed({ what, error, onRetry }: { what: string; error: unknown; onRetry: () => void }) {
  const [report, setReport] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const send = async () => {
    setReport('sending')
    try {
      await sendReport({ kind: 'crash', ...describeError(error), comment: `Falló ${what} (el resto de la pantalla siguió andando).` })
      setReport('sent')
    } catch {
      setReport('failed')
    }
  }
  return (
    <div className={styles.box} role="alert">
      <p className={styles.text}>No pudimos mostrar {what}. El resto de la pantalla sigue funcionando.</p>
      <div className={styles.actions}>
        <Button variant="secondary" size="md" onClick={onRetry}><RotateCcw size={18} aria-hidden />Reintentar</Button>
        {report === 'sent' ? (
          <span className={styles.sent} role="status">Reporte enviado. Gracias.</span>
        ) : (
          <Button variant="ghost" size="md" loading={report === 'sending'} onClick={() => void send()}>
            {report === 'failed' ? 'No se pudo enviar. Reintentar reporte' : 'Reportar'}
          </Button>
        )}
      </div>
    </div>
  )
}
