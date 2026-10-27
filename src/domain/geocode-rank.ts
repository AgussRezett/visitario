// Choosing the right place among what the geocoder found. No imports: the geocode Edge
// Function runs this same file (supabase/functions/geocode/rank.ts is a copy, checked by a
// test).

/** What the geocoder says about a place (LocationIQ / OpenStreetMap address details). */
export interface Candidate {
  lat: number
  lng: number
  label: string
  road: string
  houseNumber: string
  suburb: string | null
  state: string | null
  county: string | null
  city: string | null
}

/** The 48 barrios of the City: a store's zone helps only when it is one of them. */
export const CABA_BARRIOS = [
  'Agronomía', 'Almagro', 'Balvanera', 'Barracas', 'Belgrano', 'Boedo', 'Caballito', 'Chacarita', 'Coghlan', 'Colegiales',
  'Constitución', 'Flores', 'Floresta', 'La Boca', 'La Paternal', 'Liniers', 'Mataderos', 'Monte Castro', 'Montserrat',
  'Nueva Pompeya', 'Núñez', 'Palermo', 'Parque Avellaneda', 'Parque Chacabuco', 'Parque Chas', 'Parque Patricios',
  'Puerto Madero', 'Recoleta', 'Retiro', 'Saavedra', 'San Cristóbal', 'San Nicolás', 'San Telmo', 'Vélez Sarsfield',
  'Versalles', 'Villa Crespo', 'Villa del Parque', 'Villa Devoto', 'Villa General Mitre', 'Villa Lugano', 'Villa Luro',
  'Villa Ortúzar', 'Villa Pueyrredón', 'Villa Real', 'Villa Riachuelo', 'Villa Santa Rita', 'Villa Soldati', 'Villa Urquiza',
]

export const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/** The official barrio a zone names ("almagro", "Paternal" → "La Paternal"), or null. */
export function barrioOf(area: string | null | undefined): string | null {
  if (!area) return null
  const a = fold(area)
  return CABA_BARRIOS.find((b) => fold(b) === a || fold(b).replace(/^(la|villa|parque) /, '') === a) ?? null
}

/** The street number asked for: "Yatay 461" → "461". */
export function numberOf(query: string): string | null {
  const m = /\b(\d{1,5})\b(?!.*\b\d{1,5}\b)/.exec(query)
  return m?.[1] ?? null
}

/**
 * Inside the City: the place's own address says so (a province's town says its partido).
 * A box around the City also covers Lanús and Avellaneda across the Riachuelo, so it is
 * not enough on its own.
 */
export function inCaba(c: Pick<Candidate, 'state' | 'county' | 'city'>): boolean {
  const state = fold(c.state ?? '')
  if (/autonoma|ciudad de buenos aires|caba/.test(state)) return true
  if (/partido/.test(fold(c.county ?? ''))) return false
  // Older map data: the City as plain "Buenos Aires", with no partido.
  return /autonoma|^buenos aires$/.test(fold(c.city ?? ''))
}

/** How well a place answers the question; higher is better, and below zero it is out. */
export function score(c: Candidate, query: string, opts: { caba: boolean; barrio: string | null }): number {
  if (opts.caba && !inCaba(c)) return -1
  const wanted = numberOf(query)
  const words = fold(query.replace(/\d+/g, ' ')).split(' ').filter((w) => w.length > 2)
  const road = fold(c.road)
  let s = 1
  if (wanted && c.houseNumber === wanted) s += 100
  else if (!wanted && c.houseNumber) s += 50
  if (words.length && words.every((w) => road.includes(w))) s += 20
  if (opts.barrio && c.suburb && fold(c.suburb) === fold(opts.barrio)) s += 10
  return s
}

/** The places worth showing, best first; the exact one (same street number) leads. */
export function rank(candidates: Candidate[], query: string, opts: { caba: boolean; barrio: string | null }) {
  const wanted = numberOf(query)
  const seen = new Set<string>()
  return candidates
    .map((c) => ({ c, s: score(c, query, opts) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .filter((x) => {
      const k = `${x.c.lat.toFixed(5)},${x.c.lng.toFixed(5)}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .map(({ c }) => ({ ...c, exact: Boolean(c.houseNumber) && (!wanted || c.houseNumber === wanted) }))
}
