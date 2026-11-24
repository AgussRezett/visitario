import { useCallback, useMemo } from 'react'
import { assignSeller, rowProblem, unknownSellers, type ReviewRow } from '@/domain/add-review'
import type { Mentionable } from '@/domain/mentions'
import { Select } from '@/ui/Select'
import { channelOptions } from '../channel-choice'
import { ReviewRowEditor } from './ReviewRowEditor'
import { UnknownSellers } from './UnknownSellers'
import styles from './ReviewStep.module.scss'

interface ReviewStepProps {
  rows: ReviewRow[]
  onRows: (update: (rows: ReviewRow[]) => ReviewRow[]) => void
  onRemove: (key: string) => void
  sellers: readonly Mentionable[]
  channels: readonly Mentionable[]
  onAddSeller?: (name: string) => Promise<Mentionable>
  /** Per row: repeated, already in someone's day, or why it was not added. */
  notes: ReadonlyMap<string, string[]>
}

/** The stores to add, one row each, to check and fix before adding them all. */
export function ReviewStep({ rows, onRows, onRemove, sellers, channels, onAddSeller, notes }: ReviewStepProps) {
  const options = channels.length ? channelOptions(channels) : null
  const unknown = useMemo(() => unknownSellers(rows), [rows])
  const withoutChannel = options ? rows.filter((r) => r.channel === '').length : 0
  const pending = rows.filter((r) => rowProblem(r, Boolean(options))).length
  const change = useCallback((key: string, patch: Partial<ReviewRow>) => onRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r))), [onRows])

  return (
    <div className={styles.step}>
      <p className={styles.summary} role="status">
        {rows.length === 1 ? '1 local para agregar' : `${rows.length} locales para agregar`}
        {pending ? ` · ${pending === 1 ? 'a 1 le falta un dato' : `a ${pending} les falta un dato`}` : ' · todo listo'}
      </p>
      {options && withoutChannel ? (
        <div className={styles.bulk}>
          <Select label={withoutChannel === 1 ? 'Canal del local sin canal' : `Canal de los ${withoutChannel} sin canal`} value="" placeholder="Elegí uno para todos" options={options}
            onChange={(channel) => onRows((all) => all.map((r) => (r.channel === '' ? { ...r, channel } : r)))} />
        </div>
      ) : null}
      <UnknownSellers list={unknown} onAddSeller={onAddSeller} onCreated={(name, seller) => onRows((all) => assignSeller(all, name, seller.id))} />
      <ol className={styles.rows} aria-label="Locales para agregar">
        {rows.map((r, i) => (
          <ReviewRowEditor key={r.key} row={r} n={i + 1} sellers={sellers} channelOptions={options} problem={rowProblem(r, Boolean(options))}
            notes={notes.get(r.key) ?? []} onChange={change} onRemove={onRemove} onAddSeller={onAddSeller} />
        ))}
      </ol>
    </div>
  )
}
