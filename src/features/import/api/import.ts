import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'
import type { ImportMapping, ImportRow, StoreMatch } from '@/domain/import'

function importErrorMessage(m: string) {
  if (m.includes('row-level security') || m.includes('Workday not found')) return 'Hay filas para alguien que no es de tu equipo. Revisá la columna de activador.'
  if (m.includes('needs an address')) return 'Hay comercios nuevos sin dirección. Completalas o quitá esas filas.'
  if (m.includes('Only supervisors')) return 'Solo supervisores y administradores pueden importar.'
  return 'No pudimos importar. No se guardó nada: probá de nuevo.'
}

export interface SavedFormat {
  id: string
  name: string
  signature: string
  mapping: ImportMapping
  lastUsedAt: string | null
}

export const formatsQuery = (companyId: string) =>
  queryOptions({
    queryKey: ['import', 'formats', companyId],
    queryFn: async (): Promise<SavedFormat[]> => {
      const { data, error } = await supabase.from('import_format').select('id, name, signature, mapping, last_used_at').eq('company_id', companyId).order('last_used_at', { ascending: false, nullsFirst: false })
      if (error) throw error
      return (data ?? []).map((f) => ({ id: f.id, name: f.name, signature: f.signature, mapping: f.mapping as unknown as ImportMapping, lastUsedAt: f.last_used_at }))
    },
  })

/** Which rows are already in the directory (nothing is created). Keyed by row index. */
export const matchQuery = (companyId: string, rows: Pick<ImportRow, 'customerNumber' | 'address'>[]) =>
  queryOptions({
    queryKey: ['import', 'match', companyId, rows.map((r) => `${r.customerNumber}|${r.address}`).join('\n')],
    staleTime: 60_000,
    queryFn: async (): Promise<Map<number, StoreMatch>> => {
      const { data, error } = await supabase.rpc('match_stores', {
        p_company: companyId,
        p_rows: rows.map((r) => ({ customer_number: r.customerNumber, address: r.address })),
      })
      if (error) throw error
      return new Map(
        (data ?? []).map((m) => [
          m.idx,
          { storeId: m.store_id, name: m.name, address: m.address, area: m.area, customerNumber: m.customer_number, matchedBy: m.matched_by === 'customer' ? 'customer' : 'address' },
        ]),
      )
    },
  })

export interface ImportPayloadRow {
  merchandiser: string
  store?: string
  customer_number?: string
  name?: string
  address?: string
  area?: string
  lat?: number
  lng?: number
  location_status?: 'verified' | 'approximate'
  task?: string
  /** The store's seller and channel ids. */
  seller?: number
  channel?: number
}

export interface ImportResult {
  workdays: number
  visits: number
  stores: number
}

export function useRunImport(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { date: string; rows: ImportPayloadRow[]; format: { name: string; signature: string; mapping: ImportMapping } | null }) => {
      const { data, error } = await supabase.rpc('import_workdays', {
        p_company: companyId,
        p_date: input.date,
        p_rows: input.rows as unknown as Json,
        p_format: (input.format ?? undefined) as unknown as Json,
      })
      if (error) throw new Error(importErrorMessage(error.message))
      return data as unknown as ImportResult
    },
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ['team'] }), qc.invalidateQueries({ queryKey: ['import', 'formats'] }), qc.invalidateQueries({ queryKey: ['workday'] })]),
  })
}
