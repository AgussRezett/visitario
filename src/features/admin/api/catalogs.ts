import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ImportMapping } from '@/domain/import'

export type CatalogKind = 'brand' | 'display_type' | 'work_metric' | 'channel' | 'seller'

/** One catalog item. `extra` is the brand's group or the metric's line in the report. */
export interface CatalogItem {
  id: number
  name: string
  extra: string | null
  active: boolean
}

export interface AdminCatalogs {
  brand: CatalogItem[]
  display_type: CatalogItem[]
  work_metric: CatalogItem[]
  channel: CatalogItem[]
  seller: CatalogItem[]
  formats: { id: string; name: string; signature: string; mapping: ImportMapping; lastUsedAt: string | null }[]
}

/** Every item, active or not (the merchandiser's catalogs only bring the active ones). */
export const adminCatalogsQuery = (companyId: string) =>
  queryOptions({
    queryKey: ['admin', 'catalogs', companyId],
    queryFn: async (): Promise<AdminCatalogs> => {
      const [brands, types, metrics, formats, channels, sellers] = await Promise.all([
        supabase.from('brand').select('id, name, group_name, active').eq('company_id', companyId).order('sort_order').order('name'),
        supabase.from('display_type').select('id, name, active').eq('company_id', companyId).order('sort_order').order('name'),
        supabase.from('work_metric').select('id, name, report_label, active').eq('company_id', companyId).order('sort_order').order('name'),
        supabase.from('import_format').select('id, name, signature, mapping, last_used_at').eq('company_id', companyId).order('name'),
        supabase.from('channel').select('id, name, active, sort_order').eq('company_id', companyId).order('sort_order').order('name'),
        supabase.from('seller').select('id, name, active, person_id').eq('company_id', companyId).order('name'),
      ])
      for (const r of [brands, types, metrics, formats, channels, sellers]) if (r.error) throw r.error
      return {
        brand: (brands.data ?? []).map((b) => ({ id: b.id, name: b.name, extra: b.group_name, active: b.active })),
        display_type: (types.data ?? []).map((t) => ({ id: t.id, name: t.name, extra: null, active: t.active })),
        work_metric: (metrics.data ?? []).map((m) => ({ id: m.id, name: m.name, extra: m.report_label, active: m.active })),
        // A channel's number is its place in the list (1. Autoservicio), as the company names them.
        channel: (channels.data ?? []).map((c) => ({ id: c.id, name: c.name, extra: c.sort_order ? String(c.sort_order) : null, active: c.active })),
        seller: (sellers.data ?? []).map((x) => ({ id: x.id, name: x.name, extra: x.person_id ? 'Tiene usuario en Visitario' : null, active: x.active })),
        formats: (formats.data ?? []).map((f) => ({ id: f.id, name: f.name, signature: f.signature, mapping: f.mapping as unknown as ImportMapping, lastUsedAt: f.last_used_at })),
      }
    },
  })

const message = (m: string) =>
  m.includes('duplicate key') || m.includes('unique') ? 'Ya hay uno con ese nombre.' : 'No pudimos guardar el cambio. Probá de nuevo.'

export interface CatalogSave {
  kind: CatalogKind
  id?: number
  name?: string
  extra?: string | null
  active?: boolean
}

const base = (s: CatalogSave) => ({ ...(s.name === undefined ? {} : { name: s.name }), ...(s.active === undefined ? {} : { active: s.active }) })

/** One write per table, each with its own columns. */
async function write(companyId: string, s: CatalogSave) {
  if (s.kind === 'brand') {
    const values = { ...base(s), ...(s.extra === undefined ? {} : { group_name: s.extra }) }
    return s.id ? supabase.from('brand').update(values).eq('id', s.id) : supabase.from('brand').insert({ ...values, company_id: companyId, name: s.name ?? '' })
  }
  if (s.kind === 'work_metric') {
    const values = { ...base(s), ...(s.extra === undefined ? {} : { report_label: s.extra }) }
    return s.id ? supabase.from('work_metric').update(values).eq('id', s.id) : supabase.from('work_metric').insert({ ...values, company_id: companyId, name: s.name ?? '' })
  }
  if (s.kind === 'channel') {
    const number = s.extra === undefined ? undefined : Number(s.extra) || 0
    const values = { ...base(s), ...(number === undefined ? {} : { sort_order: number }) }
    return s.id ? supabase.from('channel').update(values).eq('id', s.id) : supabase.from('channel').insert({ ...values, company_id: companyId, name: s.name ?? '' })
  }
  if (s.kind === 'seller') {
    return s.id ? supabase.from('seller').update(base(s)).eq('id', s.id) : supabase.from('seller').insert({ ...base(s), company_id: companyId, name: s.name ?? '' })
  }
  return s.id ? supabase.from('display_type').update(base(s)).eq('id', s.id) : supabase.from('display_type').insert({ ...base(s), company_id: companyId, name: s.name ?? '' })
}

export function useCatalogAdmin(companyId: string) {
  const qc = useQueryClient()
  // The phones pick it up with their catalogs (cached for a few minutes, refreshed when online).
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['admin', 'catalogs'] }), qc.invalidateQueries({ queryKey: ['catalogs', companyId] })])
  const save = useMutation({
    mutationFn: async (s: CatalogSave) => {
      const { error } = await write(companyId, s)
      if (error) throw new Error(message(error.message))
    },
    onSettled: refresh,
  })
  const saveFormat = useMutation({
    mutationFn: async (f: { id: string; name?: string; remove?: boolean }) => {
      const { error } = f.remove
        ? await supabase.from('import_format').delete().eq('id', f.id)
        : await supabase.from('import_format').update({ name: f.name }).eq('id', f.id)
      if (error) throw new Error(message(error.message))
    },
    onSettled: () => Promise.all([refresh(), qc.invalidateQueries({ queryKey: ['import', 'formats'] })]),
  })
  return { save, saveFormat }
}
