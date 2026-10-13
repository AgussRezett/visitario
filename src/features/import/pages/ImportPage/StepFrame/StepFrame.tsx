import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import styles from './StepFrame.module.scss'

interface StepFrameProps {
  step: 1 | 2 | 3
  /** "Importar planilla", "Pegar texto"… */
  kind: string
  title: string
  onBack: () => void
  backLabel: string
  /** Desktop only, next to the title (e.g. "Para" and the date). */
  aside?: ReactNode
  footer: ReactNode
  children: ReactNode
}

/**
 * One step of the import. Phone: top bar / content that scrolls / actions, as grid rows.
 * Desktop: back link, title with the step bar, content and actions in the page flow.
 */
export function StepFrame({ step, kind, title, onBack, backLabel, aside, footer, children }: StepFrameProps) {
  return (
    <div className={styles.frame}>
      <header className={styles.appbar}>
        <button type="button" className={styles.back} onClick={onBack} aria-label={backLabel}>
          <ChevronLeft size={24} aria-hidden />
        </button>
        <span className={styles.appTitles}>
          <span className={styles.appTitle}>{kind}</span>
          <span className={styles.appMeta}>Paso {step} de 3</span>
        </span>
      </header>
      <div className={styles.scroll} data-scroll>
        <button type="button" className={styles.backLink} onClick={onBack}>
          <ChevronLeft size={16} aria-hidden />{backLabel}
        </button>
        <div className={styles.top}>
          <div className={styles.titles}>
            <span className={styles.eyebrow}>{kind} · paso {step} de 3</span>
            <h1 className={styles.title}>{title}</h1>
          </div>
          {aside ? <div className={styles.aside}>{aside}</div> : null}
        </div>
        <div className={styles.steps} aria-hidden>
          {[1, 2, 3].map((n) => <i key={n} data-state={n < step ? 'done' : n === step ? 'now' : undefined} />)}
        </div>
        {children}
      </div>
      <div className={styles.footer}>{footer}</div>
    </div>
  )
}
