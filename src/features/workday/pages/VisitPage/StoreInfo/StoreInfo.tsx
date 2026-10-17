import { Check, Copy, Map } from 'lucide-react'
import { useCopy } from '@/lib/share'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/StatusChip'
import { expectText } from '@/domain/reputation'
import type { Visit } from '@/features/workday/api/queries'
import { useStoreReputation } from '@/features/reputation/api'
import { RapportLevel } from '@/features/reputation/components/RapportLevel'
import { mapsUrl } from '@/features/workday/visit-text'
import styles from './StoreInfo.module.scss'

/** Address, customer number, task, and quick actions for getting there. */
export function StoreInfo({ visit: v }: { visit: Visit }) {
  const { copied, copy } = useCopy()
  const reputation = useStoreReputation(v.companyId, [v.store.id]).data?.get(v.store.id)
  const address = [v.store.address, v.store.area].filter(Boolean).join(' · ')
  return (
    <div className={styles.info}>
      <div className={styles.lines}>
        <span className={styles.address}>{address}</span>
        <span className={styles.meta}>{[v.store.customerNumber && `Cliente ${v.store.customerNumber}`, v.task && `Tarea: ${v.task}`].filter(Boolean).join(' · ') || 'Sin número de cliente'}</span>
        {reputation ? <RapportLevel level={reputation.level} text={expectText(reputation.level)} /> : null}
      </div>
      <div className={styles.actions}>
        <a className={styles.link} href={mapsUrl(v)} target="_blank" rel="noreferrer">
          <Map size={16} aria-hidden />Maps
        </a>
        <Button variant="secondary" size="sm" onClick={() => copy('address', v.store.address)}>
          {copied === 'address' ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          {copied === 'address' ? 'Copiada' : 'Dirección'}
        </Button>
        {v.store.locationStatus === 'verified' ? (
          <Chip tone="done" className={styles.located} icon={<Check size={14} strokeWidth={3} aria-hidden />}>Ubicada</Chip>
        ) : v.store.locationStatus === 'approximate' ? (
          <Chip tone="closed" className={styles.located}>Ubicación aproximada</Chip>
        ) : (
          <Chip tone="pending" className={styles.located}>Sin ubicación</Chip>
        )}
      </div>
    </div>
  )
}
