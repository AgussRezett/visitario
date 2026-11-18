import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** A known name of a store: who to ask for when arriving. */
export interface StoreContact {
  id: string
  name: string
  role: string | null
  note: string | null
}

export interface ContactInput {
  name: string
  role: string
  note: string
}

const key = (storeId: string) => ['store-contacts', storeId] as const

export const storeContactsQuery = (storeId: string) =>
  queryOptions({
    queryKey: key(storeId),
    enabled: Boolean(storeId),
    staleTime: 60_000,
    queryFn: async (): Promise<StoreContact[]> => {
      const { data, error } = await supabase.from('store_contact').select('id, name, role, note')
        .eq('store_id', storeId).is('deleted_at', null).order('created_at')
      if (error) throw error
      return data
    },
  })

const clean = (c: ContactInput) => ({ name: c.name.trim(), role: c.role.trim() || null, note: c.note.trim() || null })
const FAILED = 'No pudimos guardarlo. Revisá la conexión y probá de nuevo.'

/** Add, fix or remove a known name; anyone in the company can. */
export function useContacts(storeId: string) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: key(storeId) })
  const add = useMutation({
    mutationFn: async (c: ContactInput) => {
      const { error } = await supabase.from('store_contact').insert({ store_id: storeId, ...clean(c) })
      if (error) throw new Error(FAILED)
    },
    onSuccess: refresh,
  })
  const save = useMutation({
    mutationFn: async ({ id, ...c }: ContactInput & { id: string }) => {
      const { error } = await supabase.from('store_contact').update(clean(c)).eq('id', id)
      if (error) throw new Error(FAILED)
    },
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('store_contact').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw new Error('No pudimos quitarlo. Probá de nuevo.')
    },
    onSuccess: refresh,
  })
  return { add, save, remove }
}
