import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Role } from '@/domain/roles'

/**
 * In-app notices on the navigation: visits waiting for the supervisor's review, and
 * fixes the merchandiser was asked for. Refreshed every minute while the app is open.
 */
export function useNavBadges(personId: string, active: { companyId: string; role: Role } | null): Record<string, number> {
  const role = active?.role
  const companyId = active?.companyId ?? ''
  const badges = useQuery({
    queryKey: ['team', 'badges', companyId, role, personId],
    enabled: Boolean(active) && role !== 'admin',
    refetchInterval: 60_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const base = supabase.from('visit').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('deleted_at', null)
      const { count, error } =
        role === 'supervisor'
          ? await base.neq('merchandiser_id', personId).eq('review_status', 'unreviewed').in('work_status', ['done', 'refused', 'closed'])
          : await base.eq('merchandiser_id', personId).eq('review_status', 'needs_fix')
      if (error) throw error
      return role === 'supervisor' ? { review: count ?? 0 } : { workday: count ?? 0 }
    },
  })
  return badges.data ?? {}
}
