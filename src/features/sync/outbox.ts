import { useSyncExternalStore } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { uuidv7 } from '@/lib/id'
import { supabase } from '@/lib/supabase'
import { localDb, type OutboxRow } from './db'
import { PermanentError, describe, send, type Op } from './ops'

/**
 * The outbox: every change is saved on the phone first and sent in the order it was made,
 * one at a time, so a visit is never finished on the server before its storefront photo.
 * It survives closing the app. A change the server refuses stays as "failed" for the
 * merchandiser to retry or discard; anything else retries by itself.
 */

/** In memory, a change already sent stays until the refreshed data includes it. */
export interface Pending extends OutboxRow {
  sent?: boolean
}

export interface SyncState {
  rows: Pending[]
  sending: boolean
  lastSyncAt: string | null
}

const BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000]

let state: SyncState = { rows: [], sending: false, lastSyncAt: null }
const listeners = new Set<() => void>()
const waiters = new Map<string, Array<(ok: boolean) => void>>()
let client: QueryClient | null = null
let running = false
let inFlight: string | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null

function set(change: Partial<SyncState>) {
  state = { ...state, ...change }
  listeners.forEach((l) => l())
  if (change.rows) reportSoon()
}

// ---- What the supervisor sees: how much each phone still has to send, per company.
const reported = new Set<string>()
let reportTimer: ReturnType<typeof setTimeout> | null = null

function reportSoon() {
  if (reportTimer) clearTimeout(reportTimer)
  reportTimer = setTimeout(() => void report(), 2_000)
}

async function report(extra: string[] = []) {
  if (!navigator.onLine) return // reported again when signal returns
  const byCompany = new Map<string, { pending: number; failed: number; photos: number; oldest: string | null }>()
  for (const id of [...reported, ...extra]) byCompany.set(id, { pending: 0, failed: 0, photos: 0, oldest: null })
  for (const r of state.rows) {
    if (r.sent) continue
    const c = byCompany.get(r.op.companyId) ?? { pending: 0, failed: 0, photos: 0, oldest: null }
    if (r.state === 'failed') c.failed++
    else c.pending++
    if (r.op.kind === 'photo.add' && r.state !== 'failed') c.photos++
    if (!c.oldest || r.createdAt < c.oldest) c.oldest = r.createdAt
    byCompany.set(r.op.companyId, c)
  }
  for (const [companyId, c] of byCompany) {
    const { error } = await supabase.rpc('report_sync', { p_company: companyId, p_pending: c.pending, p_failed: c.failed, p_photos: c.photos, p_oldest: c.oldest ?? undefined })
    if (error) continue
    if (c.pending || c.failed) reported.add(companyId)
    else reported.delete(companyId)
  }
}

/** The phone checks in for the company it is working for (also when nothing is pending). */
export const reportFor = (companyId: string) => void report([companyId])
const setRows = (rows: Pending[]) => set({ rows })
const patchRow = (id: string, change: Partial<Pending>) => setRows(state.rows.map((r) => (r.id === id ? { ...r, ...change } : r)))

function settle(id: string, ok: boolean) {
  waiters.get(id)?.forEach((resolve) => resolve(ok))
  waiters.delete(id)
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export const useSync = () => useSyncExternalStore(subscribe, () => state)
export const getSync = () => state

/** Loads what was left from the last session and starts sending. */
export async function startSync(qc: QueryClient) {
  client = qc
  const saved = await localDb.outbox.orderBy('seq').toArray().catch(() => [] as OutboxRow[])
  setRows(saved)
  window.addEventListener('online', () => {
    kick()
    reportSoon()
  })
  kick()
}

/** Adds a change and returns its id at once; sending happens in the background. */
export async function enqueue(op: Op, place: string, options: { id?: string; blob?: Blob } = {}) {
  const row: OutboxRow = {
    id: options.id ?? uuidv7(),
    op,
    blob: options.blob,
    label: `${describe(op)} · ${place}`,
    createdAt: new Date().toISOString(),
    state: 'pending',
    attempts: 0,
  }
  setRows([...state.rows, row]) // on screen before IndexedDB answers
  try {
    row.seq = await localDb.outbox.add(row)
  } catch {
    // Storage full or blocked: the change still goes out while the app stays open.
  }
  kick()
  return row.id
}

/** Resolves true once the server has this change, false if it was refused or discarded. */
export function whenSent(id: string) {
  const row = state.rows.find((r) => r.id === id)
  if (!row || row.sent) return Promise.resolve(true) // gone from the outbox: already on the server
  if (row.state === 'failed') return Promise.resolve(false)
  return new Promise<boolean>((resolve) => waiters.set(id, [...(waiters.get(id) ?? []), resolve]))
}

/** Changes not yet on the server for a visit (sent ones excluded). */
export const unsentFor = (visitId: string) => state.rows.filter((r) => !r.sent && r.op.visitId === visitId)

/**
 * Drops changes that never left the phone, e.g. a photo deleted before it uploaded.
 * Returns the ids it dropped: one being sent right now cannot be taken back.
 */
export function drop(ids: string[]) {
  const wanted = new Set(ids)
  const gone = state.rows.filter((r) => wanted.has(r.id) && !r.sent && r.id !== inFlight)
  if (!gone.length) return []
  setRows(state.rows.filter((r) => !gone.includes(r)))
  void localDb.outbox.where('id').anyOf(gone.map((r) => r.id)).delete().catch(() => null)
  gone.forEach((r) => settle(r.id, false))
  return gone.map((r) => r.id)
}

export function retry(id: string) {
  patchRow(id, { state: 'pending', attempts: 0, error: undefined })
  void localDb.outbox.where('id').equals(id).modify({ state: 'pending', attempts: 0, error: undefined }).catch(() => null)
  kick()
}

/** Gives up on a refused change and shows what the server has instead. */
export async function discard(id: string) {
  drop([id])
  await client?.invalidateQueries({ queryKey: ['workday'] })
}

/** Sign-out: forget this person's pending changes on this phone. */
export function forgetAll() {
  state.rows.forEach((r) => settle(r.id, false))
  set({ rows: [], lastSyncAt: null })
}

/** "Reintentar ahora": skips the wait before the next attempt. */
export const syncNow = () => kick()

export function retryAll() {
  for (const r of state.rows) if (r.state === 'failed') retry(r.id)
  kick()
}

function kick() {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  void drain()
}

async function drain() {
  if (running || !client) return
  running = true
  set({ sending: true })
  let sentAny = false
  try {
    for (;;) {
      const next = state.rows.find((r) => r.state === 'pending' && !r.sent)
      if (!next) break
      if (!navigator.onLine) break // 'online' kicks again
      inFlight = next.id
      try {
        await send(next.op, next.blob)
        await localDb.outbox.where('id').equals(next.id).delete().catch(() => null)
        patchRow(next.id, { sent: true, blob: undefined })
        settle(next.id, true)
        sentAny = true
      } catch (e) {
        if (e instanceof PermanentError) {
          patchRow(next.id, { state: 'failed', error: e.message })
          await localDb.outbox.where('id').equals(next.id).modify({ state: 'failed', error: e.message }).catch(() => null)
          settle(next.id, false)
          continue
        }
        const attempts = next.attempts + 1
        patchRow(next.id, { attempts })
        await localDb.outbox.where('id').equals(next.id).modify({ attempts }).catch(() => null)
        retryTimer = setTimeout(() => kick(), BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length) - 1])
        break
      } finally {
        inFlight = null
      }
    }
  } finally {
    running = false
    set({ sending: false })
  }
  if (sentAny) {
    // Keep showing the sent changes until the refreshed data from the server includes them.
    const sent = new Set(state.rows.filter((r) => r.sent).map((r) => r.id))
    await client.invalidateQueries({ queryKey: ['workday'] }).catch(() => null)
    set({ rows: state.rows.filter((r) => !sent.has(r.id)), lastSyncAt: new Date().toISOString() })
    if (state.rows.some((r) => r.state === 'pending' && !r.sent)) kick()
  } else if (!state.rows.some((r) => !r.sent)) {
    set({ lastSyncAt: state.lastSyncAt ?? new Date().toISOString() })
  }
}
