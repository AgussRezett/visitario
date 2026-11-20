import { useQuery } from '@tanstack/react-query'
import { todayInArgentina } from '@/domain/dates'
import { sharesDay } from '@/domain/tracking'
import { visitsQuery, workdayQuery } from '@/features/workday/api/queries'
import { useShareDay } from '@/features/tracking/sharing'

/**
 * While the activador's day is under way, their phone shares where it is on every screen,
 * for their supervisor's map. It reads the day the app already has (no extra requests).
 */
export function DayTracking({ companyId, personId, personal }: { companyId: string; personId: string; personal: boolean }) {
  // Self-employed: nobody supervises them, so nothing is shared.
  const workday = useQuery({ ...workdayQuery(companyId, personId, todayInArgentina()), enabled: !personal })
  const day = workday.data ?? null
  const visits = useQuery({ ...visitsQuery(day?.id ?? '', personId), enabled: Boolean(day) })
  const on = !personal && day && visits.data ? sharesDay(day.status, visits.data) : false
  useShareDay(on && day ? day.id : null)
  return null
}
