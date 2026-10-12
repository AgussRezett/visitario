import Dexie, { type EntityTable } from 'dexie'
import type { Op } from './ops'

/** A change waiting to reach the server, in the order it was made. */
export interface OutboxRow {
  seq?: number
  /** Unique per change; also the record id it creates when it creates one (photo, display). */
  id: string
  op: Op
  /** Photo bytes, already compressed and without metadata. */
  blob?: Blob
  /** What the merchandiser sees in the sync sheet, e.g. "Foto de fachada · Moldes 1365". */
  label: string
  createdAt: string
  state: 'pending' | 'failed'
  error?: string
  attempts: number
}

interface KvRow {
  key: string
  value: unknown
}

/**
 * The phone's own copy (IndexedDB): the outbox of changes and the cached screens.
 * Cleared on sign-out, so a shared phone never shows someone else's day.
 */
class LocalDb extends Dexie {
  outbox!: EntityTable<OutboxRow, 'seq'>
  kv!: EntityTable<KvRow, 'key'>

  constructor() {
    super('visitario')
    this.version(1).stores({ outbox: '++seq, &id, state', kv: 'key' })
  }
}

export const localDb = new LocalDb()

export async function clearLocalData() {
  await Promise.all([localDb.outbox.clear(), localDb.kv.clear()])
}
