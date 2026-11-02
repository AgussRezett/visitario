import { ArrowUpDown } from 'lucide-react'
import { DIRECTORY_SORTS, type DirectorySort } from '@/domain/directory-filters'
import { Select } from '@/ui/Select'
import styles from './SortSelect.module.scss'

/** "Ordenar: Nombre (A–Z)": a pill that says which order is in use. */
export function SortSelect({ value, onChange }: { value: DirectorySort; onChange: (sort: DirectorySort) => void }) {
  return (
    <Select
      label="Ordenar comercios por"
      hideLabel
      size="sm"
      icon={<ArrowUpDown size={16} />}
      prefix="Ordenar:"
      value={value}
      options={[...DIRECTORY_SORTS]}
      searchable={false}
      onChange={(v) => onChange(DIRECTORY_SORTS.find((s) => s.value === v)?.value ?? 'name')}
      className={styles.sort}
      data-active={value !== 'name' ? 'true' : undefined}
    />
  )
}
