import { formatDayMonth, formatTime } from '@/domain/dates'
import { CONSENT_LABEL } from '@/domain/visit'
import { mapsSearchUrl } from '@/domain/places'
import type { Visit } from './api/queries'
import type { StoreTags } from './store-tags'

/** Who added the visit, as the wireframes say it. */
export function originLabel(v: Visit) {
  if (v.addedByMe) return v.source === 'added' ? 'agregada por vos' : 'asignada por vos'
  return `${v.source === 'added' ? 'agregada' : 'asignada'} por ${v.addedByName ?? 'tu supervisor'}`
}

/** Google Maps, searching the store's address (see domain/places). */
export function mapsUrl(v: Visit) {
  return mapsSearchUrl(v.store)
}

/**
 * Values a company template can use. `typeName` names the displays ("2 Puntera, Góndola");
 * `tags` are the store's channel and seller names.
 */
export function messageValues(v: Visit, merchandiser: string, typeName?: (id: number) => string, tags?: StoreTags) {
  const counts = new Map<string, number>()
  for (const d of v.displays) {
    const name = typeName?.(d.typeId) ?? 'Exhibición'
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return {
    date: formatDayMonth(v.workDate, true),
    short_date: formatDayMonth(v.workDate),
    channel: tags?.channel ?? null,
    seller: tags?.seller ?? null,
    address: v.store.address,
    store_name: v.store.name ?? v.store.address,
    customer_number: v.store.customerNumber,
    area: v.store.area,
    task: v.task,
    notes: v.notes,
    merchandiser,
    arrival: v.arrivedAt ? formatTime(v.arrivedAt) : null,
    consent: v.consent ? CONSENT_LABEL[v.consent] : null,
    displays: [...counts].map(([name, n]) => (n > 1 ? `${n} ${name}` : name)).join(', ') || null,
  }
}
