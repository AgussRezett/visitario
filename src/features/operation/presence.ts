import { useEffect, useSyncExternalStore } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Presence } from '@/domain/operations'

/**
 * Who is where in an operativo, over its private Realtime channel "operation:<id>"
 * (only who can see the operativo joins; see the database policies). Presence is never
 * stored: it lives while the app is open. One channel per operativo, shared by every
 * screen that shows it; members announce where they are, supervisors only listen.
 */

interface Me {
  personId: string
  firstName: string
}

interface Entry {
  channel: RealtimeChannel
  refs: number
  people: Presence[]
  listeners: Set<() => void>
  me: Me | null
  mine: Pick<Presence, 'visitId' | 'storeId' | 'lat' | 'lng'>
  timer?: ReturnType<typeof setTimeout>
  joined: boolean
}

const entries = new Map<string, Entry>()
const EMPTY: Presence[] = []

function readPeople(channel: RealtimeChannel): Presence[] {
  const state = channel.presenceState<Presence>()
  return Object.values(state).flatMap((metas) => {
    const last = [...metas].sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0]
    return last && typeof last.personId === 'string' ? [last] : []
  })
}

function announce(e: Entry) {
  if (!e.me || !e.joined) return
  clearTimeout(e.timer)
  // Several changes in a row (open a visit, then a location) go out once.
  e.timer = setTimeout(() => {
    if (!e.me) return
    void e.channel.track({ personId: e.me.personId, firstName: e.me.firstName, ...e.mine, at: Date.now() } satisfies Presence)
  }, 400)
}

function open(operationId: string, me: Me | null): Entry {
  const found = entries.get(operationId)
  if (found) {
    found.refs++
    if (me && !found.me) {
      found.me = me
      announce(found)
    }
    return found
  }
  const channel = supabase.channel(`operation:${operationId}`, { config: { private: true, presence: { key: me?.personId ?? `watch-${Math.random().toString(36).slice(2)}` } } })
  const e: Entry = { channel, refs: 1, people: [], listeners: new Set(), me, mine: { visitId: null, storeId: null, lat: null, lng: null }, joined: false }
  entries.set(operationId, e)
  const changed = () => {
    e.people = readPeople(channel)
    e.listeners.forEach((l) => l())
  }
  channel.on('presence', { event: 'sync' }, changed).on('presence', { event: 'join' }, changed).on('presence', { event: 'leave' }, changed)
  // Private channels need the session's token on the socket first.
  void supabase.realtime.setAuth().then(() =>
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        e.joined = true
        announce(e)
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        e.joined = false
      }
    }),
  )
  return e
}

function close(operationId: string) {
  const e = entries.get(operationId)
  if (!e) return
  e.refs--
  if (e.refs > 0) return
  clearTimeout(e.timer)
  entries.delete(operationId)
  void supabase.removeChannel(e.channel)
}

/**
 * The operativo's people right now. With `me`, I am announced too (a member); without it I
 * only listen (a supervisor).
 */
export function useOperationPresence(operationId: string | null, me: Me | null): Presence[] {
  const meKey = me ? `${me.personId}|${me.firstName}` : ''
  useEffect(() => {
    if (!operationId) return
    open(operationId, me)
    return () => close(operationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- me is compared by its key
  }, [operationId, meKey])
  return useSyncExternalStore(
    (l) => {
      const e = operationId ? entries.get(operationId) : undefined
      if (!e) return () => undefined
      e.listeners.add(l)
      return () => e.listeners.delete(l)
    },
    () => (operationId ? entries.get(operationId)?.people ?? EMPTY : EMPTY),
  )
}

/** I opened (or left) a visit of the operativo: the others see me at that store. */
export function useAnnouncePlace(operationId: string | null, place: { visitId: string; storeId: string } | null) {
  const visitId = place?.visitId ?? null
  const storeId = place?.storeId ?? null
  useEffect(() => {
    const e = operationId ? entries.get(operationId) : undefined
    if (!e) return
    e.mine = { ...e.mine, visitId, storeId }
    announce(e)
    return () => {
      const still = operationId ? entries.get(operationId) : undefined
      if (!still || still.mine.visitId !== visitId) return
      still.mine = { ...still.mine, visitId: null, storeId: null }
      announce(still)
    }
  }, [operationId, visitId, storeId])
}

/** My position for the operativo's map (null stops sharing it). */
export function announceLocation(operationId: string, at: { lat: number; lng: number } | null) {
  const e = entries.get(operationId)
  if (!e) return
  e.mine = { ...e.mine, lat: at?.lat ?? null, lng: at?.lng ?? null }
  announce(e)
}
