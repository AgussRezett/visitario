import { useEffect, useSyncExternalStore } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { sentRecently } from '@/features/sync/outbox'
import { isMyEcho, type Change } from '@/domain/realtime'

/**
 * Live updates over Realtime (websockets): the database tells the app when a visit, photo,
 * display, workday or comment of the company changes, and the screens on view refetch.
 * Only what RLS lets this person read arrives. The screens still refetch on opening and on
 * coming back to the app (the phone closes the socket in the background), so nothing
 * depends on an event arriving.
 */

const TABLES = ['visit', 'photo', 'display', 'workday', 'comment'] as const
/** Several changes in a row (a visit with its photos) become one refetch. */
const QUIET_MS = 1_200

let connected = false
const listeners = new Set<() => void>()
const setConnected = (on: boolean) => {
  if (on === connected) return
  connected = on
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
/** Whether the socket is up (screens can poll less meanwhile). */
export const useLiveConnected = () => useSyncExternalStore(subscribe, () => connected)

/** Listens to the company's changes while mounted (the app shell, once per active company). */
export function useLive(qc: QueryClient, companyId: string | null, personId: string | null) {
  useEffect(() => {
    if (!companyId) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let wasDown = false
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ['workday'] })
        void qc.invalidateQueries({ queryKey: ['team'] })
        void qc.invalidateQueries({ queryKey: ['operation'] })
        void qc.invalidateQueries({ queryKey: ['stores', 'visits'] })
      }, QUIET_MS)
    }
    let channel: RealtimeChannel = supabase.channel(`live:${companyId}`)
    for (const table of TABLES) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `company_id=eq.${companyId}` }, (change) => {
        if (personId && sentRecently() && isMyEcho(change as unknown as Change, personId)) return
        refresh()
      })
    }
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnected(true)
        // Back after a cut: what changed meanwhile did not arrive.
        if (wasDown) refresh()
        wasDown = false
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setConnected(false)
        wasDown = true
      }
    })
    return () => {
      clearTimeout(timer)
      setConnected(false)
      void supabase.removeChannel(channel)
    }
  }, [qc, companyId, personId])
}
