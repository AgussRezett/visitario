import { supabase } from '@/lib/supabase'

export interface GeocodeResult {
  label: string
  address: string
  area: string | null
  lat: number
  lng: number
  exact: boolean
}

/** Address candidates from LocationIQ; empty when the service is off or fails. */
export async function geocode(query: string, scope: 'caba' | 'argentina' = 'caba'): Promise<GeocodeResult[]> {
  if (query.trim().length < 4) return []
  const { data, error } = await supabase.functions.invoke<{ results: GeocodeResult[] }>('geocode', { body: { query, scope } })
  if (error) return []
  return data?.results ?? []
}
