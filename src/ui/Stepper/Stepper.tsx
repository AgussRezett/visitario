import { Minus, Plus } from 'lucide-react'
import styles from './Stepper.module.scss'

/** Whole-number counter with big tap targets. */
export function Stepper({ label, value, onChange, max = 9999 }: { label: string; value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div className={styles.field} role="group" aria-label={label}>
      <span className={styles.label} aria-hidden>{label}</span>
      <div className={styles.stepper}>
        <button type="button" className={styles.button} onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0} aria-label={`Restar ${label}`}>
          <Minus size={18} aria-hidden />
        </button>
        <output className={styles.value} aria-live="polite">{value}</output>
        <button type="button" className={styles.button} onClick={() => onChange(Math.min(max, value + 1))} aria-label={`Sumar ${label}`}>
          <Plus size={18} aria-hidden />
        </button>
      </div>
    </div>
  )
}
