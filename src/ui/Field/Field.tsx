import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import clsx from 'clsx'
import styles from './Field.module.scss'

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  help?: ReactNode
  error?: string | undefined
  trailing?: ReactNode
  /** Small button shown inside the input, on the right (e.g. show password). */
  action?: ReactNode
}

/** Labelled input with help and error text wired for screen readers. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, help, error, trailing, action, className, id, ...props },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const describedBy = error ? `${inputId}-error` : help ? `${inputId}-help` : undefined
  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div className={styles.row}>
        <div className={styles.control}>
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={clsx(styles.input, error && styles.invalid, action && styles.withAction, className)}
            {...props}
          />
          {action ? <span className={styles.action}>{action}</span> : null}
        </div>
        {trailing}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className={styles.error}>
          {error}
        </p>
      ) : help ? (
        <p id={`${inputId}-help`} className={styles.help}>
          {help}
        </p>
      ) : null}
    </div>
  )
})
