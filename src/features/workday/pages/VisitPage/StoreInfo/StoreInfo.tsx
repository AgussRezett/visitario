import { Check, ChevronRight, Copy, Map } from 'lucide-react'
import { useCopy } from '@/lib/share'
import { Button } from '@/ui/Button'
import { Chip } from '@/ui/StatusChip'
import { expectText } from '@/domain/reputation'
import type { Visit } from '@/features/workday/api/queries'
import { useStoreReputation } from '@/features/reputation/api'
import { RapportLevel } from '@/features/reputation/components/RapportLevel'
import { mapsUrl } from '@/features/workday/visit-text'
import { StoreTagsLine } from '@/features/workday/components/StoreTagsLine'
import type { StoreTags } from '@/features/workday/store-tags'
import styles from './StoreInfo.module.scss'

const LOCATED = { verified: 'Ubicada', approximate: 'Ubicación aproximada', unverified: 'Sin ubicación' } as const

/** Address, customer number, channel and seller, task, and quick actions for getting there. */
export function StoreInfo({ visit: v, tags, onLocate }: { visit: Visit; tags: StoreTags; onLocate?: () => void }) {
  const { copied, copy } = useCopy()
  const reputation = useStoreReputation(v.companyId, [v.store.id]).data?.get(v.store.id)
  const address = [v.store.address, v.store.area].filter(Boolean).join(' · ')
  return (
    <div className={styles.info}>
      <div className={styles.lines}>
        <span className={styles.address}>{address}</span>
        <span className={styles.meta}>{[v.store.customerNumber && `Cliente ${v.store.customerNumber}`, v.task && `Tarea: ${v.task}`].filter(Boolean).join(' · ') || 'Sin número de cliente'}</span>
        <StoreTagsLine tags={tags} />
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
        {/* Where the store landed: tapping it opens the map to check it and fix it. */}
        <button type="button" className={styles.located} onClick={onLocate} disabled={!onLocate} aria-label={`Revisar ubicación: ${LOCATED[v.store.locationStatus]}`}>
          {v.store.locationStatus === 'verified' ? (
            <Chip tone="done" icon={<Check size={14} strokeWidth={3} aria-hidden />}>Ubicada</Chip>
          ) : (
            <Chip tone={v.store.locationStatus === 'approximate' ? 'closed' : 'pending'}>{LOCATED[v.store.locationStatus]}</Chip>
          )}
          {onLocate ? <span className={styles.check}>Revisar<ChevronRight size={16} aria-hidden /></span> : null}
        </button>
      </div>
    </div>
  )
}
