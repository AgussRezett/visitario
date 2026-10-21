/**
 * Operativos: activadores going out together. An operativo is the host's workday shared:
 * its stops are worked by every member, and what is done counts in each member's day.
 */

export interface OperationMember {
  personId: string
  firstName: string
  lastName: string
  leftAt: string | null
  /** The member's own workday that date. */
  workdayId: string
}

export interface Operation {
  id: string
  /** The host's workday: the operativo's stops. */
  workdayId: string
  hostId: string
  name: string | null
  createdBy: string
  createdAt: string
  endedAt: string | null
  workdayStatus: 'draft' | 'published' | 'closed'
  members: OperationMember[]
  total: number
  visited: number
  inProgress: number
  refused: number
  closed: number
  approved: number
  needsFix: number
  /** Work totals of its visits, by metric. */
  metrics: Record<number, number>
}

/** Where a member is right now (presence: never stored). */
export interface Presence {
  personId: string
  firstName: string
  /** The visit they have open, if any. */
  visitId: string | null
  storeId: string | null
  /** Only while they share their location. */
  lat: number | null
  lng: number | null
  at: number
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)

/** The day_operations answer, read defensively. */
export function toOperations(json: unknown): Operation[] {
  if (!Array.isArray(json)) return []
  return json.flatMap((o: Record<string, unknown>) => {
    if (!o || typeof o.id !== 'string' || typeof o.workday_id !== 'string') return []
    const members = Array.isArray(o.members) ? (o.members as Record<string, unknown>[]) : []
    const status = o.workday_status === 'draft' || o.workday_status === 'closed' ? o.workday_status : 'published'
    return [{
      id: o.id,
      workdayId: o.workday_id,
      hostId: str(o.host_id),
      name: typeof o.name === 'string' && o.name ? o.name : null,
      createdBy: str(o.created_by),
      createdAt: str(o.created_at),
      endedAt: typeof o.ended_at === 'string' ? o.ended_at : null,
      workdayStatus: status,
      members: members.map((m) => ({
        personId: str(m.person_id),
        firstName: str(m.first_name),
        lastName: str(m.last_name),
        leftAt: typeof m.left_at === 'string' ? m.left_at : null,
        workdayId: str(m.workday_id),
      })),
      total: num(o.total),
      visited: num(o.visited),
      inProgress: num(o.in_progress),
      refused: num(o.refused),
      closed: num(o.closed),
      approved: num(o.approved),
      needsFix: num(o.needs_fix),
      metrics: o.metrics && typeof o.metrics === 'object' ? Object.fromEntries(Object.entries(o.metrics as Record<string, unknown>).map(([k, v]) => [Number(k), num(v)])) : {},
    }]
  })
}

export const activeMembers = (o: Operation) => o.members.filter((m) => !m.leftAt)

/** The operativo I take part in that day: the open one where I am, else the last one I worked in. */
export function myOperation(ops: readonly Operation[], personId: string): Operation | null {
  const mine = ops.filter((o) => o.members.some((m) => m.personId === personId))
  return mine.find((o) => !o.endedAt && o.members.some((m) => m.personId === personId && !m.leftAt)) ?? mine.at(-1) ?? null
}

/** Whether I work its stops now (open, and I did not leave). */
export const worksIn = (o: Operation | null, personId: string) =>
  Boolean(o && !o.endedAt && o.members.some((m) => m.personId === personId && !m.leftAt))

/** "Lucía", "Lucía y Diego", "Lucía, Diego y Ana". */
export function namesList(names: readonly string[]) {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`
}

/** Its name, or who I am with: "Operativo con Lucía y Diego". */
export function operationTitle(o: Operation, meId: string) {
  if (o.name) return o.name
  const others = activeMembers(o).filter((m) => m.personId !== meId).map((m) => m.firstName)
  return others.length ? `Operativo con ${namesList(others)}` : 'Operativo'
}

/** The others at a store right now (they have its visit open). */
export const othersAt = (presence: readonly Presence[], storeId: string, meId: string) =>
  presence.filter((p) => p.personId !== meId && p.storeId === storeId)

/** "en Cabildo 2280", "recorriendo": what a member is doing, in a few words. */
export function doingText(p: Presence, placeOf: (storeId: string) => string | null) {
  const place = p.storeId ? placeOf(p.storeId) : null
  return place ? `en ${place}` : 'recorriendo'
}

export interface Counts {
  total: number
  visited: number
  inProgress: number
  refused: number
  closed: number
  approved: number
  needsFix: number
}

/**
 * An operativo's visits count in each member's row; in the team's sums they must count
 * once. What to take off: the operativo's counts, once per extra member among `people`.
 */
export function sharedRepeats(ops: readonly Operation[], people: readonly string[]): Counts & { metrics: Record<number, number> } {
  const acc: Counts = { total: 0, visited: 0, inProgress: 0, refused: 0, closed: 0, approved: 0, needsFix: 0 }
  const metrics: Record<number, number> = {}
  for (const o of ops) {
    const extra = o.members.filter((m) => people.includes(m.personId)).length - 1
    if (extra <= 0) continue
    for (const k of Object.keys(acc) as (keyof Counts)[]) acc[k] += o[k] * extra
    for (const [id, q] of Object.entries(o.metrics)) metrics[Number(id)] = (metrics[Number(id)] ?? 0) + q * extra
  }
  return { ...acc, metrics }
}
