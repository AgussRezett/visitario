import type { SelectOption } from '@/ui/Select'

// The channel of a new store starts unchosen: the person picks one, or "Sin canal" on purpose.
// '' is unchosen (the select shows its placeholder); NONE is "Sin canal".

export const NONE = 'none'

export const channelOptions = (channels: readonly { id: number; name: string }[]): SelectOption[] =>
  [{ value: NONE, label: 'Sin canal' }, ...channels.map((c) => ({ value: String(c.id), label: c.name }))]

/** The channel id to save: null for "Sin canal" (and for unchosen, which is never sent). */
export const channelIdOf = (value: string): number | null => (value && value !== NONE ? Number(value) : null)
