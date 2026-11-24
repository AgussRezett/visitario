import { memo } from 'react'
import { BookMarked, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import type { ReviewRow } from '@/domain/add-review'
import type { Mentionable } from '@/domain/mentions'
import { Field } from '@/ui/Field'
import { Select, type SelectOption } from '@/ui/Select'
import { SellerPicker } from '@/features/workday/components/SellerPicker'
import styles from './ReviewStep.module.scss'

interface ReviewRowEditorProps {
  row: ReviewRow
  n: number
  sellers: readonly Mentionable[]
  channelOptions: SelectOption[] | null
  problem: string | null
  /** Repeated in the list, already in someone's day, or why it was not added. */
  notes: string[]
  onChange: (key: string, patch: Partial<ReviewRow>) => void
  onRemove: (key: string) => void
  onAddSeller?: (name: string) => Promise<Mentionable>
}

/** One store to add, every part editable. */
export const ReviewRowEditor = memo(function ReviewRowEditor({ row, n, sellers, channelOptions, problem, notes, onChange, onRemove, onAddSeller }: ReviewRowEditorProps) {
  const set = (patch: Partial<ReviewRow>) => onChange(row.key, patch)
  const k = row.known
  const what = k?.address ?? (row.address || row.customerNumber || `local ${n}`)
  return (
    <li className={clsx(styles.row, problem && styles.rowProblem, k && styles.rowKnown)} aria-label={`Local ${n}: ${what}`}>
      <span className={styles.n} aria-hidden>{n}</span>
      {k ? (
        // Already in the directory: that store goes, as it is there.
        <div className={styles.known}>
          <p className={styles.knownTag}><BookMarked size={14} aria-hidden />Ya está en el directorio · {k.by === 'customer' ? 'mismo nro. de cliente' : 'misma dirección'}</p>
          <p className={styles.knownName}>{k.name ? `${k.name} · ` : ''}{k.address}</p>
          <p className={styles.knownMeta}>{[k.area, k.customerNumber ? `Nro. ${k.customerNumber}` : row.customerNumber ? `Nro. ${row.customerNumber} (se lo agregamos)` : null].filter(Boolean).join(' · ')}</p>
        </div>
      ) : (<>
      <div className={styles.address}>
        <Field label="Dirección" value={row.address} onChange={(e) => set({ address: e.target.value })} autoComplete="off" />
      </div>
      <div className={styles.number}>
        <Field label="Nro. de cliente" value={row.customerNumber} onChange={(e) => set({ customerNumber: e.target.value })} inputMode="numeric" autoComplete="off" />
      </div>
      <div className={styles.area}>
        <Field label="Barrio" value={row.area} onChange={(e) => set({ area: e.target.value })} autoComplete="off" />
      </div>
      </>)}
      <div className={styles.seller}>
        <SellerPicker sellers={sellers} value={row.sellerId} onChange={(sellerId) => set({ sellerId, sellerName: sellerId === null ? row.sellerName : '' })} onAddSeller={onAddSeller} />
        {row.sellerId === null && row.sellerName ? <p className={styles.read}>Leído: {row.sellerName} (todavía no está cargado)</p> : null}
      </div>
      {channelOptions ? (
        <div className={styles.channel}>
          <Select label="Canal" value={row.channel} onChange={(channel) => set({ channel })} placeholder="Elegí uno" options={channelOptions} />
        </div>
      ) : null}
      <button type="button" className={styles.remove} onClick={() => onRemove(row.key)} aria-label={`Quitar ${what}`}>
        <Trash2 size={18} aria-hidden />
      </button>
      {row.task ? <p className={styles.task}>Tarea: {row.task}</p> : null}
      {problem || notes.length ? (
        <ul className={styles.notes}>
          {problem ? <li className={styles.problem}>{problem}</li> : null}
          {notes.map((t) => <li key={t}>{t}</li>)}
        </ul>
      ) : null}
    </li>
  )
})
