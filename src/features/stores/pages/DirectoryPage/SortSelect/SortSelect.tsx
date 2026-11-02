import { ArrowUpDown, ChevronDown } from 'lucide-react'
import { DIRECTORY_SORTS, type DirectorySort } from '@/domain/directory-filters'
import styles from './SortSelect.module.scss'

/** "Ordenar: Nombre (A–Z)": the phone's own picker, in a pill that says what is in use. */
export function SortSelect({ value, onChange }: { value: DirectorySort; onChange: (sort: DirectorySort) => void }) {
  const current = DIRECTORY_SORTS.find((s) => s.value === value) ?? DIRECTORY_SORTS[0]
  return (
    <label className={styles.sort} data-active={value !== 'name' || undefined}>
      <ArrowUpDown size={16} aria-hidden className={styles.icon} />
      <span className={styles.text}>
        <span className={styles.prefix}>Ordenar:</span> {current?.label}
      </span>
      <ChevronDown size={16} aria-hidden className={styles.chevron} />
      <select
        className={styles.select}
        aria-label="Ordenar comercios por"
        value={value}
        onChange={(e) => onChange(DIRECTORY_SORTS.find((s) => s.value === e.target.value)?.value ?? 'name')}
      >
        {DIRECTORY_SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </label>
  )
}
