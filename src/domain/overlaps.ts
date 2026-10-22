import { isVisited, type WorkStatus } from './visit'

/** Another day of the company that already has the store being added (public.day_overlaps). */
export interface Overlap {
  /** Which of the rows asked about it answers. */
  idx: number
  sameWorkday: boolean
  merchandiserFirst: string
  merchandiserLast: string
  addedByFirst: string | null
  /** The activador added it themself; otherwise someone assigned it. */
  addedByMerchandiser: boolean
  workStatus: WorkStatus
}

/** The answers grouped by the row they are about. */
export function overlapsByRow(list: Overlap[]): Map<number, Overlap[]> {
  const rows = new Map<number, Overlap[]>()
  for (const o of list) rows.set(o.idx, [...(rows.get(o.idx) ?? []), o])
  return rows
}

const shortName = (o: Overlap) => `${o.merchandiserFirst}${o.merchandiserLast ? ` ${o.merchandiserLast.slice(0, 1)}.` : ''}`

const joinNames = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : (names[0] ?? ''))

/**
 * One sentence about who else has the store: "Lucía G. ya lo tiene en su jornada de hoy, asignado por Martín."
 * `when` is "de hoy" or "de ese día". Null when nobody else has it.
 */
export function overlapText(list: Overlap[], when: string): string | null {
  if (!list.length) return null
  if (list.some((o) => o.sameWorkday)) return 'Ya está en esta jornada.'
  const names = [...new Set(list.map(shortName))]
  if (names.length > 1) return `${joinNames(names)} ya lo tienen en su jornada ${when}.`
  const o = list[0] as Overlap
  const how = o.addedByMerchandiser ? 'lo sumó por su cuenta' : o.addedByFirst ? `asignado por ${o.addedByFirst}` : 'asignado'
  const state = isVisited(o.workStatus) ? ' y ya lo visitó' : o.workStatus === 'in_progress' ? ' y está ahí ahora' : ''
  return `${names[0]} ya lo tiene en su jornada ${when}, ${how}${state}.`
}
