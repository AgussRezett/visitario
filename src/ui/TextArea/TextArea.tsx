import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'
import styles from './TextArea.module.scss'

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  help?: ReactNode
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea({ label, help, className, id, ...props }, ref) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>{label}</label>
      <textarea ref={ref} id={inputId} className={clsx(styles.input, className)} aria-describedby={help ? `${inputId}-help` : undefined} {...props} />
      {help ? <p id={`${inputId}-help`} className={styles.help}>{help}</p> : null}
    </div>
  )
})
