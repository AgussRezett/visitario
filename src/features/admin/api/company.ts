import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Enums } from '@/lib/supabase'

export interface CompanySettings {
  id: string
  name: string
  geocodingScope: Enums<'geocoding_scope'>
  showWhatsapp: boolean
  photoRetentionMonths: number
  logoVersion: number | null
}

export const companyQuery = (companyId: string) =>
  queryOptions({
    queryKey: ['admin', 'company', companyId],
    queryFn: async (): Promise<CompanySettings> => {
      const { data, error } = await supabase
        .from('company')
        .select('id, name, geocoding_scope, show_whatsapp, photo_retention_months, logo_version')
        .eq('id', companyId)
        .single()
      if (error) throw error
      return {
        id: data.id,
        name: data.name,
        geocodingScope: data.geocoding_scope,
        showWhatsapp: data.show_whatsapp,
        photoRetentionMonths: data.photo_retention_months,
        logoVersion: data.logo_version,
      }
    },
  })

export interface CompanyChange {
  name?: string
  geocodingScope?: Enums<'geocoding_scope'>
  showWhatsapp?: boolean
  photoRetentionMonths?: number
}

export function useCompanyUpdate(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: CompanyChange) => {
      const { error } = await supabase
        .from('company')
        .update({ name: c.name, geocoding_scope: c.geocodingScope, show_whatsapp: c.showWhatsapp, photo_retention_months: c.photoRetentionMonths })
        .eq('id', companyId)
      if (error) throw new Error('No pudimos guardar el cambio. Probá de nuevo.')
    },
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['admin', 'company', companyId] }),
        qc.invalidateQueries({ queryKey: ['catalogs', companyId] }),
        qc.invalidateQueries({ queryKey: ['me'] }),
      ]),
  })
}
