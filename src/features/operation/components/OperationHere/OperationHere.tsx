import { Users } from 'lucide-react'
import { namesList, othersAt, worksIn } from '@/domain/operations'
import type { Visit } from '@/features/workday/api/queries'
import { useDayOperations } from '@/features/operation/api'
import { useAnnouncePlace, useOperationPresence } from '@/features/operation/presence'
import styles from './OperationHere.module.scss'

/**
 * Inside a visit of an operativo: the team sees I am at this store, and I see who else is
 * here, so two people do not arrange the same display.
 */
export function OperationHere({ visit: v, meId, firstName }: { visit: Visit; meId: string; firstName: string }) {
  const ops = useDayOperations(v.companyId, v.workDate)
  const op = (ops.data ?? []).find((o) => o.workdayId === v.workdayId && !o.endedAt) ?? null
  const mine = worksIn(op, meId)
  const presence = useOperationPresence(op?.id ?? null, mine ? { personId: meId, firstName } : null)
  useAnnouncePlace(mine ? op?.id ?? null : null, { visitId: v.id, storeId: v.store.id })
  if (!op) return null
  const there = othersAt(presence, v.store.id, meId).map((p) => p.firstName)
  return (
    <p className={styles.here} role="status">
      <Users size={16} aria-hidden />
      {there.length
        ? `${namesList(there)} también ${there.length === 1 ? 'está' : 'están'} acá: repártanse las exhibiciones.`
        : 'Visita del operativo: el equipo ve lo que cargás al momento.'}
    </p>
  )
}
