import { formatDayMonth } from '@/domain/dates'
import type { Visit } from './api/queries'

/** Who added the visit, as the wireframes say it. */
export function originLabel(v: Visit) {
  if (v.addedByMe) return v.source === 'added' ? 'agregada por vos' : 'asignada por vos'
  return `${v.source === 'added' ? 'agregada' : 'asignada'} por ${v.addedByName ?? 'tu supervisor'}`
}

export function mapsUrl(v: Visit) {
  const q = v.store.lat !== null && v.store.lng !== null ? `${v.store.lat},${v.store.lng}` : `${v.store.address}, ${v.store.area ?? 'Buenos Aires'}, Argentina`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

/** Values a company template can use. */
export function messageValues(v: Visit, merchandiser: string) {
  return {
    date: formatDayMonth(v.workDate, true),
    address: v.store.address,
    store_name: v.store.name ?? v.store.address,
    customer_number: v.store.customerNumber,
    area: v.store.area,
    task: v.task,
    notes: v.notes,
    merchandiser,
  }
}
