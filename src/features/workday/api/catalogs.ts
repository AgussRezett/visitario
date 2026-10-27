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

interface CatalogsRow {
  brands: { id: number; name: string }[]
  display_types: { id: number; name: string }[]
  metrics: { id: number; name: string; report_label: string | null }[]
  templates: { kind: TemplateKind; body: string }[]
  company: { show_whatsapp: boolean; messages_per_display: boolean } | null
  channels: { id: number; name: string; active: boolean; sort_order: number }[]
  sellers: { id: number; name: string; person_id: string | null; active: boolean }[]
}

export const catalogsQuery = (companyId: string) =>
  queryOptions({
    queryKey: workdayKeys.catalogs(companyId),
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Catalogs> => {
      // One request for everything a company's screens need (company_catalogs).
      const { data, error } = await supabase.rpc('company_catalogs', { p_company: companyId })
      if (error) throw error
      const c = data as unknown as CatalogsRow
      const own = Object.fromEntries((c.templates ?? []).map((t) => [t.kind, t.body])) as Partial<Record<TemplateKind, string>>
      return {
        brands: c.brands ?? [],
        displayTypes: c.display_types ?? [],
        channels: (c.channels ?? []).map((x) => ({ id: x.id, name: x.name, active: x.active, number: x.sort_order })),
        sellers: (c.sellers ?? []).map((x) => ({ id: x.id, name: x.name, personId: x.person_id, active: x.active })),
        metrics: (c.metrics ?? []).map((m) => ({ id: m.id, name: m.name, reportLabel: m.report_label })),
        templates: { ...DEFAULT_TEMPLATES, ...own },
        showWhatsapp: c.company?.show_whatsapp ?? true,
        messagesPerDisplay: c.company?.messages_per_display ?? false,
      }
    },
  })

export function useCatalogs(companyId: string) {
  return useQuery(catalogsQuery(companyId))
}
