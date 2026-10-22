import { queryOptions, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { DEFAULT_TEMPLATES, type TemplateKind } from '@/domain/templates'
import { workdayKeys } from './keys'

export interface Catalogs {
  brands: { id: number; name: string }[]
  displayTypes: { id: number; name: string }[]
  /** Kinds of shop, in the company's order (1. Autoservicio…). */
  /** Inactive ones too (stores keep them); pickers offer only the active. */
  channels: { id: number; name: string; active: boolean; /** The company's number for it (1. Autoservicio). */ number: number }[]
  sellers: { id: number; name: string; personId: string | null; active: boolean }[]
  metrics: { id: number; name: string; reportLabel: string | null }[]
  templates: Record<TemplateKind, string>
  /** The company still uses WhatsApp as the bridge: show the copy buttons on the visit. */
  showWhatsapp: boolean
  /** One ANTES / DESPUÉS per display instead of one per visit. */
  messagesPerDisplay: boolean
}

export const catalogsQuery = (companyId: string) =>
  queryOptions({
    queryKey: workdayKeys.catalogs(companyId),
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Catalogs> => {
      const [brands, types, metrics, templates, company, channels, sellers] = await Promise.all([
        supabase.from('brand').select('id, name').eq('company_id', companyId).eq('active', true).order('sort_order').order('name'),
        supabase.from('display_type').select('id, name').eq('company_id', companyId).eq('active', true).order('sort_order').order('name'),
        supabase.from('work_metric').select('id, name, report_label').eq('company_id', companyId).eq('active', true).order('sort_order'),
        supabase.from('message_template').select('kind, body').eq('company_id', companyId),
        supabase.from('company').select('show_whatsapp, messages_per_display').eq('id', companyId).maybeSingle(),
        supabase.from('channel').select('id, name, active, sort_order').eq('company_id', companyId).order('sort_order').order('name'),
        supabase.from('seller').select('id, name, person_id, active').eq('company_id', companyId).order('name'),
      ])
      for (const r of [brands, types, metrics, templates, company, channels, sellers]) if (r.error) throw r.error
      const own = Object.fromEntries((templates.data ?? []).map((t) => [t.kind, t.body])) as Partial<Record<TemplateKind, string>>
      return {
        brands: brands.data ?? [],
        displayTypes: types.data ?? [],
        channels: (channels.data ?? []).map((c) => ({ id: c.id, name: c.name, active: c.active, number: c.sort_order })),
        sellers: (sellers.data ?? []).map((s) => ({ id: s.id, name: s.name, personId: s.person_id, active: s.active })),
        metrics: (metrics.data ?? []).map((m) => ({ id: m.id, name: m.name, reportLabel: m.report_label })),
        templates: { ...DEFAULT_TEMPLATES, ...own },
        showWhatsapp: company.data?.show_whatsapp ?? true,
        messagesPerDisplay: company.data?.messages_per_display ?? false,
      }
    },
  })

export function useCatalogs(companyId: string) {
  return useQuery(catalogsQuery(companyId))
}
