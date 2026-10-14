// How a store is looked up outside Visitario (Google Maps) and how a person can fix
// its location by hand when the geocoder only finds the street.

export interface LatLng {
  lat: number
  lng: number
}

/**
 * What Google Maps searches for: the address and the city. Not the coordinates, which
 * may be approximate and make Maps show a pin with another address; not the zone either,
 * which can be the company's own name for an area ("Villa Urquiza 2").
 */
export function mapsQuery(store: { address: string }): string {
  return `${store.address.trim()}, Buenos Aires, Argentina`
}

export function mapsSearchUrl(store: { address: string }): string {
  return `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: mapsQuery(store) })}`
}

// Roughly Argentina: a typo or swapped numbers end up far away and are refused.
const inArgentina = (p: LatLng) => p.lat >= -55.5 && p.lat <= -21 && p.lng >= -74 && p.lng <= -53

const NUM = String.raw`(-?\d{1,2}\.\d+)`
const PATTERNS = [
  new RegExp(String.raw`!3d${NUM}!4d${NUM}`), // a place's link: the exact pin
  new RegExp(String.raw`@${NUM},${NUM}`), // a map's link: where it is centred
  new RegExp(String.raw`[?&](?:q|query|ll|destination)=${NUM}(?:,|%2C)\s*${NUM}`),
  new RegExp(String.raw`^\s*${NUM}\s*[,;\s]\s*${NUM}\s*$`), // "-34.58784, -58.49370"
]

/**
 * Coordinates pasted by a person: "-34.58784, -58.49370" (what Google Maps copies when
 * you hold on a place) or a Google Maps link that carries them. Null when there are none.
 */
export function parseLocation(text: string): LatLng | null {
  const t = text.trim()
  for (const re of PATTERNS) {
    const m = re.exec(t)
    if (!m) continue
    const p = { lat: Number(m[1]), lng: Number(m[2]) }
    if (Number.isFinite(p.lat) && Number.isFinite(p.lng) && inArgentina(p)) return p
  }
  return null
}
