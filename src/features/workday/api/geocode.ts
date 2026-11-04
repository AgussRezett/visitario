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

/**
 * The activador fixes where a store of their day is: the pin and, if they changed it, the
 * address (the street number, usually). Saved as verified, with who did it.
 */
export async function fixStoreLocation(storeId: string, point: { lat: number; lng: number }, address?: string): Promise<void> {
  const { error } = await supabase.rpc('fix_store_location', { p_store: storeId, p_lat: point.lat, p_lng: point.lng, p_address: address })
  if (error) throw new Error(error.code === '42501' ? 'Solo podés corregir locales de tus jornadas.' : error.code === '22023' ? 'Esa ubicación no parece estar en Argentina.' : 'No pudimos guardarla. Revisá la conexión y probá de nuevo.')
}

/** The phone's position with how sure it is (metres), once, when the person asks. Never stored. */
export function positionHere(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('unsupported'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      reject,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  })
}
