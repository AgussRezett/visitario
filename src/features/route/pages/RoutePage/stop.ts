import { formatHour } from '@/domain/dates'
import type { Visit } from '@/features/workday/api/queries'

export const placeName = (v: Visit) => v.store.name ?? v.store.address

/** What the stop says under its name: why it matters for the order. */
export function stopNote(v: Visit) {
  if (v.workStatus === 'closed') return v.retryAfter ? `Cerrado · volver después de las ${formatHour(v.retryAfter)}` : 'Cerrado · volver más tarde'
  if (v.reviewStatus === 'needs_fix') return 'Corrección pendiente'
  const where = v.store.name ? v.store.address : v.store.area
  return [v.source === 'added' ? 'Extra' : null, where].filter(Boolean).join(' · ')
}
