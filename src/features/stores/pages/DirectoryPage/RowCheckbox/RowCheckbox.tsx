import { useEffect, useRef } from 'react'
import type { DirectoryRow } from '@/features/stores/api/stores'
import type { Selection } from '@/features/stores/useSelection'
import styles from './RowCheckbox.module.scss'

/** A row's checkbox, in a 44 px target. */
export function RowCheckbox({ row, label, selection }: { row: DirectoryRow; label: string; selection: Selection }) {
  return (
    <label className={styles.target}>
      <input type="checkbox" className={styles.box} checked={selection.has(row.id)} onChange={() => selection.toggle(row)} aria-label={`Seleccionar ${label}`} />
    </label>
  )
}

/** The rows on this page: all, some (a dash) or none marked. */
export function PageCheckbox({ rows, selection }: { rows: readonly DirectoryRow[]; selection: Selection }) {
  const ref = useRef<HTMLInputElement>(null)
  const marked = rows.filter((r) => selection.has(r.id)).length
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = marked > 0 && marked < rows.length
  }, [marked, rows.length])
  return (
    <label className={styles.target}>
      <input ref={ref} type="checkbox" className={styles.box} checked={rows.length > 0 && marked === rows.length} onChange={() => selection.toggleAll(rows)} aria-label="Seleccionar los de esta página" />
    </label>
  )
}
