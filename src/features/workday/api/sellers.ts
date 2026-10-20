import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useMe } from '@/features/auth/me'
import { workdayKeys } from './keys'

/** Admins add sellers right where they assign them (the database only lets admins). */
export function useCanAddSellers(companyId: string) {
  const me = useMe().data
  return Boolean(me?.memberships.some((m) => m.companyId === companyId && m.roles.includes('admin')))
}

/** A new seller by name; if it already exists (same name), that one. */
export function useAddSeller(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string): Promise<{ id: number; name: string }> => {
      const clean = name.replace(/\s+/g, ' ').trim()
      const { data, error } = await supabase.from('seller').insert({ company_id: companyId, name: clean }).select('id, name').single()
      if (!error) return data
      const { data: found } = await supabase.from('seller').select('id, name').eq('company_id', companyId).ilike('name', clean).maybeSingle()
      if (found) return found
      throw new Error('No pudimos agregar el vendedor. Probá de nuevo.')
    },
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: workdayKeys.catalogs(companyId) }), qc.invalidateQueries({ queryKey: ['admin', 'catalogs'] })]),
  })
}
