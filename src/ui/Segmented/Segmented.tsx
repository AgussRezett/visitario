import styles from './Segmented.module.scss'

export interface SegmentOption<T extends string> {
  value: T
  label: string
}

/** Single-choice control rendered as a radio group. */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: SegmentOption<T>[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.group}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)} className={styles.option}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
