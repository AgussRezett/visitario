import { cn } from '@/lib/cn'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

/** Single-choice control rendered as a radio group. */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: SegmentOption<T>[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-md bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn('h-10 rounded-sm text-label font-bold text-ink-muted', o.value === value && 'bg-card text-ink shadow-sm')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
