import { Check } from 'lucide-react'
import styles from './ToggleTag.module.scss'

export interface TagOption<T> {
  value: T
  label: string
}

/** Several-choice tags (brands, display types). */
export function ToggleTags<T extends string | number>({ label, options, selected, onToggle }: { label: string; options: TagOption<T>[]; selected: T[]; onToggle: (v: T) => void }) {
  return (
    <div className={styles.group} role="group" aria-label={label}>
      {options.map((o) => {
        const on = selected.includes(o.value)
        return (
          <button key={o.value} type="button" className={styles.tag} aria-pressed={on} onClick={() => onToggle(o.value)}>
            {on ? <Check size={14} strokeWidth={3} aria-hidden /> : null}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
