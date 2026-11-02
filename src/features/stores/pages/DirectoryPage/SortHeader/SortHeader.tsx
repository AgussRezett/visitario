import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { headerSort, type DirectorySort } from '@/domain/directory-filters'
import styles from './SortHeader.module.scss'

type Column = Parameters<typeof headerSort>[0]

/** Which sorts belong to each column, and which way they go. */
const DIRECTION: Partial<Record<DirectorySort, { column: Column; dir: 'ascending' | 'descending' }>> = {
  name: { column: 'name', dir: 'ascending' },
  customer: { column: 'customer', dir: 'ascending' },
  area: { column: 'area', dir: 'ascending' },
  recent_visit: { column: 'last_visit', dir: 'descending' },
  oldest_visit: { column: 'last_visit', dir: 'ascending' },
  most_visits: { column: 'visits', dir: 'descending' },
}

/** A table header that sorts by its column; the arrow says which way. */
export function SortHeader({ column, label, sort, onSort }: { column: Column; label: string; sort: DirectorySort; onSort: (s: DirectorySort) => void }) {
  const on = DIRECTION[sort]?.column === column ? DIRECTION[sort] : undefined
  const Icon = !on ? ArrowUpDown : on.dir === 'ascending' ? ArrowUp : ArrowDown
  return (
    <th aria-sort={on?.dir ?? 'none'}>
      <button type="button" className={styles.button} data-on={on ? true : undefined} onClick={() => onSort(headerSort(column, sort))}>
        {label}
        <Icon size={14} aria-hidden className={styles.icon} />
      </button>
    </th>
  )
}
