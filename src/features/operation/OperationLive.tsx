import { todayInArgentina } from '@/domain/dates'
import { myOperation, worksIn } from '@/domain/operations'
import { useDayOperations } from './api'
import { useShareLocation } from './location'
import { useOperationPresence } from './presence'

/**
 * While an activador works in today's operativo, the app stays in its channel on every
 * screen: the others see them, and their location goes out if they chose to share it.
 */
export function OperationLive({ companyId, personId, firstName }: { companyId: string; personId: string; firstName: string }) {
  const ops = useDayOperations(companyId, todayInArgentina())
  const op = myOperation(ops.data ?? [], personId)
  const id = op && worksIn(op, personId) && op.workdayStatus !== 'draft' ? op.id : null
  useOperationPresence(id, { personId, firstName })
  useShareLocation(id)
  return null
}
