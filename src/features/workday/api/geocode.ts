import { supabase } from '@/lib/supabase'

export interface GeocodeResult {
  label: string
  address: string
  area: string | null
  lat: number
  lng: number
  exact: boolean
}

/**
 * Address candidates from LocationIQ, best first; empty when the service is off or fails.
 * `area`: the store's zone, a hint when it is one of the City's barrios.
 */
export async function geocode(query: string, scope: 'caba' | 'argentina' = 'caba', area?: string | null): Promise<GeocodeResult[]> {
  if (query.trim().length < 4) return []
  const { data, error } = await supabase.functions.invoke<{ results: GeocodeResult[] }>('geocode', { body: { query, scope, area: area ?? undefined } })
  if (error) return []
  return data?.results ?? []
}

/** What locating a store on the server did. */
export type StoreLocated = 'verified' | 'approximate' | 'not_found' | 'kept'

/**
 * Locates a store of my company and saves it, on the server: it works for whoever added it
 * (an activador cannot edit stores). A verified or hand-pinned location is never touched.
 * Throws when it could not ask (no signal, service down), so it can be tried again later.
 */
export async function verifyStore(storeId: string): Promise<StoreLocated> {
  const { data, error } = await supabase.functions.invoke<{ status: StoreLocated }>('geocode', { body: { storeId } })
  if (error || !data) throw new Error('verify_failed')
  return data.status
}
