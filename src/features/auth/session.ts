import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { readLocal, writeLocal } from '@/lib/storage'
import { clearLocalData, localDb } from '@/features/sync/db'
import { forgetAll } from '@/features/sync/outbox'
import { meQuery, refreshMe, type Me } from './me'

/**
 * Who is signed in on this phone: the user id, null when no one is, or undefined when it
 * can't be told (the token expired and there is no signal to renew it; the day goes on).
 */
export async function sessionUser(): Promise<string | null | undefined> {
  const { data, error } = await supabase.auth.getSession()
  if (data.session) return data.session.user.id
  return error && isAuthRetryableFetchError(error) ? undefined : null
}

/**
 * "me" for the route guards. The copy saved on the phone only counts while its session is
 * alive: once the session is gone (site data cleared, signed out on another device, token
 * revoked) the app goes back to sign-in instead of opening screens that can't load.
 */
export async function ensureMe(queryClient: QueryClient): Promise<Me | null> {
  const user = await sessionUser()
  if (user === null) {
    if (queryClient.getQueryData(meQuery.queryKey)) await dropSession(queryClient)
    return null
  }
  let me = await queryClient.ensureQueryData(meQuery)
  // Signed in after the copy was saved, or as someone else: ask again.
  if (user && me?.userId !== user) me = await refreshMe(queryClient).catch(() => me)
  if (me) claimPhone(me.userId)
  return me
}

/**
 * The session ended without "Cerrar sesión" here: forget the saved screens. Changes not yet
 * sent stay, so they go out when the same person signs in again (see claimPhone).
 */
export async function dropSession(queryClient: QueryClient) {
  queryClient.clear()
  queryClient.setQueryData(meQuery.queryKey, null)
  await localDb.kv.clear().catch(() => null)
}

const OWNER = 'visitario.owner'

/** Someone else signs in on this phone: the previous person's unsent changes are not theirs. */
function claimPhone(userId: string) {
  const owner = readLocal(OWNER)
  if (owner === userId) return
  if (owner) {
    forgetAll()
    void clearLocalData().catch(() => null)
  }
  writeLocal(OWNER, userId)
}
