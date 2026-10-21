import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Shift, TeamMember } from '@/domain/team'
import { TEAM_VISIT_SELECT } from '@/features/workday/api/selects'
import { toVisit, type Visit, type VisitRow } from '@/features/workday/api/queries'

export const teamKeys = {
  all: ['team'] as const,
  day: (companyId: string, date: string) => ['team', 'day', companyId, date] as const,
  review: (companyId: string, tab: ReviewTab, date: string) => ['team', 'review', companyId, tab, date] as const,
  counts: (companyId: string, date: string) => ['team', 'review-counts', companyId, date] as const,
  visit: (visitId: string) => ['team', 'visit', visitId] as const,
}

/**
 * Changes arrive live (features/live); this slow refetch is only the safety net for a
 * socket that dropped without saying so.
 */
const LIVE = { refetchInterval: 5 * 60_000, refetchIntervalInBackground: false } as const

export const teamDayQuery = (companyId: string, date: string) =>
  queryOptions({
    queryKey: teamKeys.day(companyId, date),
    ...LIVE,
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase.rpc('team_day', { p_company: companyId, p_date: date })
      if (error) throw error
      return (data ?? []).map((r) => ({
        personId: r.person_id,
        firstName: r.first_name,
        lastName: r.last_name,
        workdayId: r.workday_id,
        workdayStatus: r.workday_status,
        total: r.total,
        visited: r.visited,
        inProgress: r.in_progress,
        refused: r.refused,
        closed: r.closed,
        approved: r.approved,
        needsFix: r.needs_fix,
        toReview: r.to_review,
        lastActivityAt: r.last_activity_at,
        lastPlace: r.last_place,
        syncPending: r.sync_pending,
        syncFailed: r.sync_failed,
        syncPhotos: r.sync_photos,
        syncReportedAt: r.sync_reported_at,
      }))
    },
  })

/** A visit in the supervisor's lists: who did it, and the usual visit data. */
export interface TeamVisit extends Visit {
  merchandiserId: string
  merchandiserName: string
  reviewedAt: string | null
  updatedAt: string
}

type TeamVisitRow = VisitRow & {
  merchandiser_id: string
  reviewed_at: string | null
  updated_at: string
  merchandiser: { first_name: string; last_name: string } | null
}

export const toTeamVisit = (r: TeamVisitRow, personId: string): TeamVisit => ({
  ...toVisit(r, personId),
  merchandiserId: r.merchandiser_id,
  merchandiserName: r.merchandiser ? `${r.merchandiser.first_name} ${r.merchandiser.last_name}`.trim() : '',
  reviewedAt: r.reviewed_at,
  updatedAt: r.updated_at,
})

export type ReviewTab = 'to_review' | 'needs_fix' | 'approved' | 'all'

const FINISHED = ['done', 'refused', 'closed'] as const

/**
 * The review inbox. "Por revisar" and "Con corrección" span every day (oldest first);
 * "Aprobadas" and "Todas" are for the chosen day. Visits of the supervisor themself
 * never appear: nobody reviews their own work.
 */
// A supervisor who also visits stores reviews their own visits too (no one else would).
function reviewFilter(companyId: string, tab: ReviewTab, date: string) {
  let q = supabase.from('visit').select(TEAM_VISIT_SELECT).eq('company_id', companyId).is('deleted_at', null)
  if (tab === 'to_review') q = q.eq('review_status', 'unreviewed').in('work_status', [...FINISHED]).order('finished_at', { ascending: true })
  if (tab === 'needs_fix') q = q.eq('review_status', 'needs_fix').order('updated_at', { ascending: true })
  if (tab === 'approved') q = q.eq('review_status', 'approved').eq('work_date', date).order('reviewed_at', { ascending: false })
  if (tab === 'all') q = q.eq('work_date', date).order('merchandiser_id').order('sort_order')
  return q.limit(200)
}

export const reviewQuery = (companyId: string, personId: string, tab: ReviewTab, date: string) =>
  queryOptions({
    queryKey: teamKeys.review(companyId, tab, date),
    ...LIVE,
    queryFn: async () => {
      const { data, error } = await reviewFilter(companyId, tab, date)
      if (error) throw error
      return (data as unknown as TeamVisitRow[]).map((r) => toTeamVisit(r, personId))
    },
  })

/** How many in each tab, for the tabs and the navigation badge. */
export const reviewCountsQuery = (companyId: string, date: string) =>
  queryOptions({
    queryKey: teamKeys.counts(companyId, date),
    ...LIVE,
    queryFn: async (): Promise<Record<ReviewTab, number>> => {
      const count = async (tab: ReviewTab) => {
        let q = supabase.from('visit').select('id', { count: 'exact', head: true }).eq('company_id', companyId).is('deleted_at', null)
        if (tab === 'to_review') q = q.eq('review_status', 'unreviewed').in('work_status', [...FINISHED])
        if (tab === 'needs_fix') q = q.eq('review_status', 'needs_fix')
        if (tab === 'approved') q = q.eq('review_status', 'approved').eq('work_date', date)
        if (tab === 'all') q = q.eq('work_date', date)
        const { count: n, error } = await q
        if (error) throw error
        return n ?? 0
      }
      const [toReview, needsFix, approved, all] = await Promise.all([count('to_review'), count('needs_fix'), count('approved'), count('all')])
      return { to_review: toReview, needs_fix: needsFix, approved, all }
    },
  })

export const teamVisitQuery = (visitId: string, personId: string) =>
  queryOptions({
    queryKey: teamKeys.visit(visitId),
    queryFn: async () => {
      const { data, error } = await supabase.from('visit').select(TEAM_VISIT_SELECT).eq('id', visitId).maybeSingle()
      if (error) throw error
      return data ? toTeamVisit(data as unknown as TeamVisitRow, personId) : null
    },
  })

export const memberPendingQuery = (companyId: string, merchandiserId: string, before: string) =>
  queryOptions({
    queryKey: ['team', 'pending', companyId, merchandiserId, before] as const,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('merchandiser_pending', { p_company: companyId, p_merchandiser: merchandiserId, p_before: before })
      if (error) throw error
      return data ?? []
    },
  })

/** Working hours: the company's, and each person's own when it differs. */
export interface Shifts {
  company: Shift
  byPerson: Record<string, Shift>
}

export const shiftsQuery = (companyId: string) =>
  queryOptions({
    queryKey: ['team', 'shifts', companyId],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Shifts> => {
      const [company, own] = await Promise.all([
        supabase.from('company').select('shift_start, shift_end').eq('id', companyId).single(),
        supabase.from('membership').select('person_id, shift_start, shift_end').eq('company_id', companyId).not('shift_start', 'is', null),
      ])
      if (company.error) throw company.error
      if (own.error) throw own.error
      return {
        company: { start: company.data.shift_start.slice(0, 5), end: company.data.shift_end.slice(0, 5) },
        byPerson: Object.fromEntries((own.data ?? []).map((m) => [m.person_id, { start: (m.shift_start ?? '').slice(0, 5), end: (m.shift_end ?? '').slice(0, 5) }])),
      }
    },
  })

export const shiftOf = (shifts: Shifts | undefined, personId: string): Shift | undefined => (shifts ? shifts.byPerson[personId] ?? shifts.company : undefined)
