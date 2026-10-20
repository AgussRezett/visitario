import type { Catalogs } from './api/queries'

/** The names of a store's channel and seller. */
export interface StoreTags {
  channel: string | null
  seller: string | null
}

type Lists = Partial<Pick<Catalogs, 'channels' | 'sellers'>> | undefined

/** Looked up in the catalogs (a phone with catalogs cached before channels existed gets none). */
export function storeTags(catalogs: Lists, store: { channelId: number | null; sellerId: number | null }): StoreTags {
  return {
    channel: catalogs?.channels?.find((c) => c.id === store.channelId)?.name ?? null,
    seller: catalogs?.sellers?.find((s) => s.id === store.sellerId)?.name ?? null,
  }
}

/** Options for a picker: the active ones, plus the one already chosen even if inactive now. */
export function pickable<T extends { id: number; name: string; active: boolean }>(list: readonly T[] | undefined, current: number | null) {
  return (list ?? []).filter((x) => x.active || x.id === current)
}
