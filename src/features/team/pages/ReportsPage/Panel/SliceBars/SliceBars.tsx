import { useState } from 'react'
import { Segmented } from '@/ui/Segmented'
import { breakdown, type Facts } from '@/domain/analytics'
import { num, pct } from '../format'
import styles from './SliceBars.module.scss'

type By = 'ch' | 'se' | 'area'
const EMPTY: Record<By, string> = { ch: 'Sin canal', se: 'Sin vendedor', area: 'Sin zona' }

/** Visits by channel, seller or zone: where the work goes, and where they say no. */
export function SliceBars({ facts, channelName, sellerName }: { facts: Facts; channelName: (id: number) => string; sellerName: (id: number) => string }) {
  const [by, setBy] = useState<By>('ch')
  const slices = breakdown(facts, by).slice(0, 10)
  const max = Math.max(1, ...slices.map((s) => s.visited))
  const name = (key: string) => (key === '' ? EMPTY[by] : by === 'ch' ? channelName(Number(key)) : by === 'se' ? sellerName(Number(key)) : key)
  return (
    <div className={styles.box}>
      <Segmented label="Ver por" value={by} onChange={setBy} options={[{ value: 'ch', label: 'Canal' }, { value: 'se', label: 'Vendedor' }, { value: 'area', label: 'Zona' }]} />
      {slices.length ? (
        <ul className={styles.list}>
          {slices.map((s) => (
            <li key={s.key} className={styles.row}>
              <span className={styles.name} title={name(s.key)}>{name(s.key)}</span>
              <span className={styles.track} aria-hidden>
                <span className={styles.done} style={{ width: `${(s.done / max) * 100}%` }} />
                <span className={styles.refused} style={{ width: `${(s.refused / max) * 100}%` }} />
                <span className={styles.other} style={{ width: `${((s.visited - s.done - s.refused) / max) * 100}%` }} />
              </span>
              <span className={styles.value}>{num(s.visited)}</span>
              <span className={styles.meta}>{s.stores === 1 ? '1 local' : `${num(s.stores)} locales`} · {pct(s.visited ? s.refused / s.visited : null)} no aut.</span>
            </li>
          ))}
        </ul>
      ) : <p className={styles.empty}>Sin visitas en el período.</p>}
    </div>
  )
}
