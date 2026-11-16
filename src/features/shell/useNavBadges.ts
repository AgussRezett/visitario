import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Role } from '@/domain/roles'

/**
 * In-app notices on the navigation: visits waiting for the supervisor's review and open
 * novedades, the open novedades of a seller's clients, and fixes the merchandiser was asked for. Live (features/live), with a slow safety refetch.
 */
export function useNavBadges(personId: string, active: { companyId: string; role: Role } | null): Record<string, number> {
  const role = active?.role
  const companyId = active?.companyId ?? ''
  const badges = useQuery({
    queryKey: ['team', 'badges', companyId, role, personId],
    enabled: Boolean(active) && role !== 'admin',
    refetchInterval: 5 * 60_000, // changes arrive live; this is the safety net
    queryFn: async (): Promise<Record<string, number>> => {
      const openIssues = () => supabase.from('store_issue').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'open').is('deleted_at', null)
      if (role === 'seller') {
        const mine = await openIssues() // the database shows a seller only their clients'
        if (mine.error) throw mine.error
        return { issues: mine.count ?? 0 }
      }
      const base = supabase.from('visit').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('deleted_at', null)
      const { count, error } =
        role === 'supervisor'
          ? await base.eq('review_status', 'unreviewed').in('work_status', ['done', 'refused', 'closed'])
          : await base.eq('merchandiser_id', personId).eq('review_status', 'needs_fix')
      if (error) throw error
      if (role !== 'supervisor') return { workday: count ?? 0 }
      const issues = await openIssues()
      return { review: count ?? 0, issues: issues.count ?? 0 }
    },
  })
  return badges.data ?? {}
}
