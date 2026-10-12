import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

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
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-label font-bold text-ink">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-12 w-full min-w-0 rounded-md border-[1.5px] border-control bg-card px-3.5 text-base text-ink',
            'placeholder:text-ink-subtle read-only:bg-muted',
            error && 'border-refused',
            className,
          )}
          {...props}
        />
        {trailing}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-label font-semibold text-refused-ink">
          {error}
        </p>
      ) : help ? (
        <p id={`${inputId}-help`} className="text-label text-ink-subtle">
          {help}
        </p>
      ) : null}
    </div>
  )
})
