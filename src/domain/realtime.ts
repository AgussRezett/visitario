/** A change that arrives over Realtime (postgres_changes). */
export type Change = { table: string; eventType: string; new: Record<string, unknown> }

/**
 * My own change coming back: the sync already refreshed after sending it, so another
 * refetch would only repeat it (only right after this phone sent something: the same
 * person on another device still needs it). Only when the row says for sure it was me: displays and
 * workdays only carry who created them, so their later changes may be someone else's.
 */
export function isMyEcho(c: Change, me: string) {
  const row = c.new ?? {}
  if (c.table === 'visit') return row.updated_by === me
  if (c.table === 'comment') return row.author_id === me
  if (c.table === 'photo') return row.created_by === me
  if (c.table === 'display') return c.eventType === 'INSERT' && row.created_by === me
  return false
}
