import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { meQuery } from '@/features/auth/me'

export interface ClosePreview {
  name: string
  personal: boolean
  members: number
  invited: number
  stores: number
  /** Days published for today: someone may be working right now. */
  daysToday: number
}

export interface ClosedCompany {
  companyId: string
  name: string
  closedAt: string
  closedBy: string
  reopenUntil: string
}

export const closePreviewQuery = (companyId: string) =>
  queryOptions({
    queryKey: ['company', companyId, 'close-preview'],
    queryFn: async (): Promise<ClosePreview | null> => {
      const { data, error } = await supabase.rpc('company_close_preview', { p_company: companyId })
      if (error) throw error
      const r = data?.[0]
      return r ? { name: r.name, personal: r.kind === 'personal', members: r.members, invited: r.invited, stores: r.stores, daysToday: r.days_today } : null
    },
  })

/** Closed companies I can still reopen. */
export const closedCompaniesQuery = queryOptions({
  queryKey: ['closed-companies'],
  queryFn: async (): Promise<ClosedCompany[]> => {
    const { data, error } = await supabase.rpc('my_closed_companies')
    if (error) throw error
    return (data ?? []).map((r) => ({ companyId: r.company_id, name: r.name, closedAt: r.closed_at, closedBy: r.closed_by, reopenUntil: r.reopen_until }))
  },
})

/** After closing or reopening, who I am and where I work changes: ask again. */
function useRefreshAccess() {
  const qc = useQueryClient()
  return async () => {
    await qc.invalidateQueries({ queryKey: closedCompaniesQuery.queryKey })
    await qc.invalidateQueries({ queryKey: meQuery.queryKey })
  }
}

export function useCloseCompany(companyId: string) {
  const refresh = useRefreshAccess()
  return useMutation({
    mutationFn: async ({ name, reason }: { name: string; reason: string }) => {
      const { error } = await supabase.rpc('close_company', { p_company: companyId, p_name: name, p_reason: reason.trim() || null })
      if (error) {
        throw new Error(/name/i.test(error.message) ? 'El nombre no coincide. Escribilo tal cual.' : /personal/i.test(error.message)
          ? 'Tu cuenta de trabajo independiente no se cierra desde acá.' : 'No pudimos cerrar la empresa. Probá de nuevo.')
      }
    },
    onSuccess: refresh,
  })
}

export function useReopenCompany() {
  const refresh = useRefreshAccess()
  return useMutation({
    mutationFn: async (companyId: string) => {
      const { error } = await supabase.rpc('reopen_company', { p_company: companyId })
      if (error) throw new Error('No pudimos reabrirla. Si pasaron más de 30 días, escribinos a Visitario.')
    },
    onSuccess: refresh,
  })
}
