import type { Enums } from '@/lib/supabase'
import { addDays, formatDayMonth } from './dates'
import type { WorkStatus } from './visit'

export type StoreSource = Enums<'store_source'>
export type LocationStatus = Enums<'location_status'>

export const LOCATION_LABEL: Record<LocationStatus, string> = { verified: 'Verificada', approximate: 'Aproximada', unverified: 'Sin verificar' }

/** "Importado el 01/10 por Martín", "Agregado por Agus el 09/10", "Cargado el 03/10". */
export function originText(source: StoreSource, createdAt: string, by: string | null) {
  const when = formatDayMonth(createdAt.slice(0, 10))
  if (source === 'imported') return `Importado el ${when}${by ? ` por ${by}` : ''}`
  if (source === 'merchandiser') return `Agregado${by ? ` por ${by}` : ''} el ${when}`
  return `Cargado el ${when}${by ? ` por ${by}` : ''}`
}

export interface StoreVisit {
  workDate: string
  workStatus: WorkStatus
  reviewStatus: Enums<'review_status'>
  arrivedAt: string | null
  finishedAt: string | null
  displayTypeIds: number[]
}

/** The store's numbers: visits in 30 days, approved, not authorized, average time inside. */
export function storeStats(visits: StoreVisit[], today: string) {
  const since = addDays(today, -30)
  const recent = visits.filter((v) => v.workDate >= since)
  const minutes = visits
    .filter((v) => v.arrivedAt && v.finishedAt)
    .map((v) => (new Date(v.finishedAt as string).getTime() - new Date(v.arrivedAt as string).getTime()) / 60_000)
    .filter((m) => m > 0 && m < 8 * 60)
  return {
    last30: recent.length,
    approved: visits.filter((v) => v.reviewStatus === 'approved').length,
    refused: visits.filter((v) => v.workStatus === 'refused').length,
    averageMinutes: minutes.length ? Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length) : null,
  }
}

/** Display types seen in the last visits, most frequent first ("Puntera", "Góndola"). */
export function usualDisplays(visits: StoreVisit[], typeName: (id: number) => string, last = 4) {
  const counts = new Map<number, number>()
  for (const v of [...visits].sort((a, b) => b.workDate.localeCompare(a.workDate)).slice(0, last)) {
    for (const id of new Set(v.displayTypeIds)) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([id]) => typeName(id))
}
