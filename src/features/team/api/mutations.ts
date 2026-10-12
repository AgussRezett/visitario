import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { WorkdayError, workdayErrorMessage } from '@/features/workday/api/mutations'

const check = (error: { message: string; code?: string } | null) => {
  if (error) throw new WorkdayError(workdayErrorMessage(error))
}

/** Supervisor changes touch the team screens and the merchandiser's day alike. */
function useRefresh() {
  const qc = useQueryClient()
  return () => Promise.all([qc.invalidateQueries({ queryKey: ['team'] }), qc.invalidateQueries({ queryKey: ['workday'] })])
}

export function useReview() {
  const refresh = useRefresh()
  return {
    approve: useMutation({
      mutationFn: async (visitId: string) => check((await supabase.from('visit').update({ review_status: 'approved' }).eq('id', visitId)).error),
      onSettled: refresh,
    }),
    requestFix: useMutation({
      mutationFn: async (p: { visitId: string; body: string; displayId: string | null }) =>
        check((await supabase.rpc('request_fix', { p_visit: p.visitId, p_body: p.body.trim(), p_display: p.displayId ?? undefined })).error),
      onSettled: refresh,
    }),
  }
}

export function useAssign(companyId: string) {
  const refresh = useRefresh()
  return {
    /** The merchandiser's draft for the date (or the existing workday). */
    plan: useMutation({
      mutationFn: async (p: { merchandiserId: string; date: string }) => {
        const { data, error } = await supabase.rpc('plan_workday', { p_company: companyId, p_merchandiser: p.merchandiserId, p_date: p.date })
        check(error)
        return data as string
      },
      onSettled: refresh,
    }),
    copy: useMutation({
      mutationFn: async (p: { from: string; to: string }) => {
        const { data, error } = await supabase.rpc('copy_workday', { p_from: p.from, p_to: p.to })
        check(error)
        return data as number
      },
      onSettled: refresh,
    }),
    resume: useMutation({
      mutationFn: async (p: { visitIds: string[]; workdayId: string }) => {
        for (const id of p.visitIds) check((await supabase.rpc('resume_visit', { p_visit: id, p_workday: p.workdayId })).error)
      },
      onSettled: refresh,
    }),
    setTask: useMutation({
      mutationFn: async (p: { visitId: string; task: string }) => check((await supabase.from('visit').update({ task: p.task.trim() || null }).eq('id', p.visitId)).error),
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: async (visitId: string) => check((await supabase.from('visit').update({ deleted_at: new Date().toISOString() }).eq('id', visitId)).error),
      onSettled: refresh,
    }),
    /** Publishes these drafts: each merchandiser sees their day from then on. */
    publish: useMutation({
      mutationFn: async (workdayIds: string[]) => {
        if (!workdayIds.length) return 0
        const { data, error } = await supabase.from('workday').update({ status: 'published' }).in('id', workdayIds).eq('status', 'draft').select('id')
        check(error)
        return data?.length ?? 0
      },
      onSettled: refresh,
    }),
  }
}
