import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'
import styles from './Sheet.module.scss'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

/**
 * Modal built on <dialog>: focus stays inside, Escape and the backdrop close it.
 * Bottom sheet on phones, centered panel on desktop.
 */
export function Sheet({ open, onClose, title, subtitle, children, footer, wide }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal?.()
    if (!open && dialog.open) dialog.close?.()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={clsx(styles.sheet, wide && styles.wide)}
      aria-labelledby={titleId}
      onClose={(e) => {
        if (e.target === e.currentTarget) onClose() // not a dialog opened inside this one
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      {open ? (
        <div className={styles.panel}>
          <span className={styles.grab} aria-hidden />
          <div className={styles.header}>
            <div className={styles.titles}>
              <h2 id={titleId} className={styles.title}>{title}</h2>
              {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
            </div>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar">
              <X size={22} aria-hidden />
            </button>
          </div>
          <div className={styles.body}>{children}</div>
          {footer ? <div className={styles.footer}>{footer}</div> : null}
        </div>
      ) : null}
    </dialog>
  )
}
