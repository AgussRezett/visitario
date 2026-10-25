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
