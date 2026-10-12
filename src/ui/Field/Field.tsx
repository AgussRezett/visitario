import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import clsx from 'clsx'
import styles from './Field.module.scss'

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  help?: ReactNode
  error?: string | undefined
  trailing?: ReactNode
}

/** Labelled input with help and error text wired for screen readers. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, help, error, trailing, className, id, ...props },
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
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={clsx(styles.input, error && styles.invalid, className)}
          {...props}
        />
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
