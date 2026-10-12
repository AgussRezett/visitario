import { forwardRef, useId, type SelectHTMLAttributes } from 'react'
import clsx from 'clsx'
import styles from './Select.module.scss'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  options: { value: string | number; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, options, className, id, ...props }, ref) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div className={styles.field}>
      <label htmlFor={inputId} className={styles.label}>{label}</label>
      <select ref={ref} id={inputId} className={clsx(styles.select, className)} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
})
