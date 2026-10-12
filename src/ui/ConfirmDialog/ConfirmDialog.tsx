import { useEffect, useId, useRef, type ReactNode } from 'react'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import clsx from 'clsx'
import { Button } from '@/ui/Button'
import styles from './ConfirmDialog.module.scss'

export interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** `danger` for actions that remove or undo something. */
  tone?: 'default' | 'danger'
}

interface ConfirmDialogProps extends Partial<ConfirmOptions> {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Asks before an action, in place of the browser's confirm(). Built on <dialog>:
 * Escape and the backdrop cancel; focus starts on "Cancelar" so a stray tap does nothing.
 */
export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = 'Cancelar', tone = 'default', onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal?.()
    if (!open && dialog.open) dialog.close?.()
  }, [open])

  const Icon = tone === 'danger' ? AlertTriangle : HelpCircle
  return (
    <dialog
      ref={ref}
      role="alertdialog"
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      // React propagates dialog events through the component tree: keep them away from
      // the Sheet or viewer this dialog opens on top of.
      onClose={(e) => e.stopPropagation()}
      onCancel={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onCancel()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCancel()
      }}
    >
      {open ? (
        <div className={styles.panel}>
          <span className={clsx(styles.icon, tone === 'danger' && styles.iconDanger)} aria-hidden>
            <Icon size={22} />
          </span>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          {description ? <div id={descriptionId} className={styles.description}>{description}</div> : null}
          <div className={styles.actions}>
            <Button variant="secondary" size="md" onClick={onCancel} autoFocus>{cancelLabel}</Button>
            <Button variant="primary" size="md" onClick={onConfirm} className={clsx(tone === 'danger' && styles.confirmDanger)}>{confirmLabel}</Button>
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
