import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { myOperation, worksIn } from '@/domain/operations'
import { visitsQuery, type Workday } from '@/features/workday/api/queries'
import { useDayOperations } from './api'

/**
 * My day with its operativo: my own stops plus, when I am a member (not the host), the
 * operativo's stops first. Its results count in my day (progress, report, route).
 * `operationStops` tells which stops are the operativo's.
 */
export function useOperationDay(companyId: string, personId: string, workday: Workday | null | undefined, date: string) {
  const ops = useDayOperations(companyId, date)
  const op = myOperation(ops.data ?? [], personId)
  const guestOf = op && workday && op.workdayId !== workday.id ? op : null
  const own = useQuery({ ...visitsQuery(workday?.id ?? '', personId), enabled: Boolean(workday), placeholderData: keepPreviousData })
  const shared = useQuery({ ...visitsQuery(guestOf?.workdayId ?? '', personId), enabled: Boolean(guestOf) })

  const visits = useMemo(
    () => (guestOf ? (own.data || shared.data ? [...(shared.data ?? []), ...(own.data ?? [])] : undefined) : own.data),
    [guestOf, own.data, shared.data],
  )
  const operationStops = useMemo(() => {
    if (!op) return new Set<string>()
    const list = guestOf ? shared.data : op.workdayId === workday?.id ? own.data : undefined
    return new Set((list ?? []).map((v) => v.id))
  }, [op, guestOf, shared.data, own.data, workday?.id])

  return {
    op,
    /** I can work its stops now (open, not left). */
    works: worksIn(op, personId),
    isHost: Boolean(op && op.hostId === personId),
    /** Where new stops go: the operativo while I work in it, else my day. */
    addTo: op && worksIn(op, personId) ? op.workdayId : workday?.id ?? null,
    visits,
    operationStops,
    isPending: own.isPending || Boolean(guestOf && shared.isPending),
    isError: own.isError || shared.isError,
    isPlaceholderData: own.isPlaceholderData,
    refetch: () => Promise.all([own.refetch(), shared.refetch(), ops.refetch()]),
  }
}
