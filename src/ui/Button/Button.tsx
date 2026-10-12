import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'lime'
type Size = 'lg' | 'md' | 'sm'

const variants: Record<Variant, string> = {
  primary: 'bg-action text-action-ink hover:bg-action-hover',
  secondary: 'bg-card text-ink border-[1.5px] border-control hover:bg-muted',
  ghost: 'bg-transparent text-forest hover:bg-muted dark:text-lime',
  danger: 'bg-transparent text-refused-ink hover:bg-refused-soft',
  lime: 'bg-lime text-forest hover:brightness-95',
}

const sizes: Record<Size, string> = {
  lg: 'h-[52px] px-5 text-base',
  md: 'h-11 px-4 text-[15px]',
  sm: 'h-9 px-3 text-label',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'lg', loading = false, className, disabled, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-extrabold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-55',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden /> : null}
      {children}
    </button>
  )
})
