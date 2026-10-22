import { Plus, Store } from 'lucide-react'
import type { Database } from '@/lib/database.types'
import type { Overlap } from '@/domain/overlaps'
import { OverlapNote } from '@/features/workday/components/OverlapNote'
import styles from './DirectoryResults.module.scss'

export type FoundStore = Database['public']['Functions']['search_stores']['Returns'][number]

interface DirectoryResultsProps {
  stores: FoundStore[]
  /** The store being added, marked while it saves. */
  picked: string | null
  busy: boolean
  onPick: (storeId: string) => void
  /** Who else has each store that day, by its place in `stores`. */
  overlaps?: Map<number, Overlap[]>
  when: string
}

/** Stores of the directory that match the search: one tap adds it to the day. */
export function DirectoryResults({ stores, picked, busy, onPick, overlaps, when }: DirectoryResultsProps) {
  return (
    <div className={styles.list}>
      <span className={styles.eyebrow}>En el directorio</span>
      {stores.map((s, i) => (
        <div key={s.id} className={styles.item}>
          <button
            type="button"
            className={styles.result}
            data-picked={picked === s.id || undefined}
            aria-busy={picked === s.id}
            aria-describedby={overlaps?.get(i)?.length ? `overlap-${s.id}` : undefined}
            disabled={busy}
            onClick={() => onPick(s.id)}
          >
            <span className={styles.resultIcon}><Store size={16} aria-hidden /></span>
            <span className={styles.resultText}>
              <span className={styles.resultName}>{s.name ?? s.address}</span>
              <span className={styles.resultMeta}>
                {[s.name ? s.address : s.area, s.customer_number && `Cliente ${s.customer_number}`].filter(Boolean).join(' · ')}
              </span>
            </span>
            {picked === s.id ? (
              <span className={styles.resultAdding}><span className={styles.ring} aria-hidden />Agregando…</span>
            ) : (
              <span className={styles.resultAdd}><Plus size={18} aria-hidden />Agregar</span>
            )}
          </button>
          <OverlapNote id={`overlap-${s.id}`} list={overlaps?.get(i)} when={when} />
        </div>
      ))}
    </div>
  )
}
