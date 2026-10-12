import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'
import { localDb } from './db'

const KEY = 'query-cache'

/** Saves the query cache to IndexedDB at most once a second. */
function throttled(save: (client: PersistedClient) => Promise<void>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let latest: PersistedClient | null = null
  return (client: PersistedClient) => {
    latest = client
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      if (latest) void save(latest).catch(() => null)
    }, ms)
  }
}

export const persister: Persister = {
  persistClient: throttled(async (client) => {
    await localDb.kv.put({ key: KEY, value: client })
  }, 1000),
  restoreClient: async () => (await localDb.kv.get(KEY))?.value as PersistedClient | undefined,
  removeClient: async () => {
    await localDb.kv.delete(KEY)
  },
}

/** Screens kept for working without signal: everything except short-lived photo links. */
export const PERSIST_OPTIONS = {
  persister,
  maxAge: 7 * 24 * 60 * 60_000,
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (q: { state: { status: string }; queryKey: readonly unknown[] }) =>
      q.state.status === 'success' && q.queryKey[0] !== 'photo-urls',
  },
}
