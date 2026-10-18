import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CompanyKind, PlanKind } from '@/domain/company'
import { platformError, toSupportSnapshot, type PlatformCompany, type PlatformTotals, type SubscriptionStatus } from '@/domain/platform'

const keys = {
  all: ['platform'] as const,
  companies: ['platform', 'companies'] as const,
  totals: ['platform', 'totals'] as const,
  support: (companyId: string) => ['platform', 'support', companyId] as const,
}

/** A database refusal, already in Spanish. */
export class PlatformError extends Error {}
const fail = (error: { message: string }) => new PlatformError(platformError(error.message))

export const platformCompaniesQuery = queryOptions({
  queryKey: keys.companies,
  queryFn: async (): Promise<PlatformCompany[]> => {
    const { data, error } = await supabase.rpc('platform_companies')
    if (error) throw error
    return data.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind,
      createdAt: r.created_at,
      plan: r.plan,
      status: r.status,
      endsOn: r.ends_on,
      members: r.members,
      invited: r.invited,
      admins: r.admins,
      visits30d: r.visits_30d,
      lastActivityAt: r.last_activity_at,
      photos: r.photos,
      photoBytes: Number(r.photo_bytes),
      aiCaptures: r.ai_captures,
      aiCostThousandths: r.ai_cost_usd_thousandths,
      supportUntil: r.support_until,
    }))
  },
})

export const platformTotalsQuery = queryOptions({
  queryKey: keys.totals,
  queryFn: async (): Promise<PlatformTotals> => {
    const { data, error } = await supabase.rpc('platform_totals')
    if (error) throw error
    const r = data[0]
    return {
      activePeople: r?.active_people ?? 0,
      photos: r?.photos ?? 0,
      photoBytes: Number(r?.photo_bytes ?? 0),
      dbBytes: Number(r?.db_bytes ?? 0),
      aiCaptures: r?.ai_captures ?? 0,
      aiCostThousandths: r?.ai_cost_usd_thousandths ?? 0,
    }
  },
})

/** Read-only look at a company; only while my support session is open. */
export const supportQuery = (companyId: string) =>
  queryOptions({
    queryKey: keys.support(companyId),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('support_company', { p_company: companyId })
      if (error) throw fail(error)
      return toSupportSnapshot(data)
    },
  })

export interface NewCompany {
  name: string
  kind: CompanyKind
  plan: PlanKind
  endsOn: string
  adminDni: string
  firstName: string
  lastName: string
  phone: string
}

export function usePlatform() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: keys.all })
  const optional = (v: string) => v.trim() || undefined

  const create = useMutation({
    mutationFn: async (c: NewCompany) => {
      const { data, error } = await supabase.rpc('platform_create_company', {
        p_name: c.name.trim(),
        p_kind: c.kind,
        p_plan: c.plan,
        // An end date only means something for a pilot or a paid plan with a deadline.
        p_ends_on: c.endsOn || null,
        p_admin_dni: c.adminDni.replace(/\D/g, ''),
        p_first_name: optional(c.firstName),
        p_last_name: optional(c.lastName),
        p_phone: optional(c.phone.replace(/[\s-]/g, '')),
      })
      if (error) throw fail(error)
      return data
    },
    onSuccess: refresh,
  })

  const setPlan = useMutation({
    mutationFn: async (p: { companyId: string; plan: PlanKind; status: SubscriptionStatus; endsOn: string }) => {
      const { error } = await supabase.rpc('platform_set_plan', {
        p_company: p.companyId,
        p_plan: p.plan,
        p_status: p.status,
        p_ends_on: p.endsOn || null,
      })
      if (error) throw fail(error)
    },
    onSuccess: refresh,
  })

  const startSupport = useMutation({
    mutationFn: async (p: { companyId: string; reason: string }) => {
      const { data, error } = await supabase.rpc('start_support', { p_company: p.companyId, p_reason: p.reason.trim() })
      if (error) throw fail(error)
      return data
    },
    onSuccess: refresh,
  })

  return { create, setPlan, startSupport }
}
