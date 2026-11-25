// Novedades: the message for the store's seller, and when each one was reported.

export interface IssueForMessage {
  type: string
  note: string | null
  store: { name: string | null; address: string; area: string | null; customerNumber: string | null }
  by: string
  /** "06/11 14:30" */
  when: string
}

/** What goes to the seller by WhatsApp, ready to send: the store, what it needs and who saw it. */
export function sellerMessage(i: IssueForMessage, seller: string | null): string {
  const store = [i.store.customerNumber ? `#${i.store.customerNumber}` : null, i.store.name, i.store.address].filter(Boolean).join(' · ')
  return [
    seller ? `Hola ${seller.split(' ')[0]}! Novedad de un cliente tuyo:` : 'Novedad de un cliente:',
    `*${i.type}*`,
    `${store}${i.store.area ? ` (${i.store.area})` : ''}`,
    i.note ? `Detalle: ${i.note}` : null,
    `Lo vio ${i.by.split(' ')[0]} el ${i.when}.`,
  ].filter(Boolean).join('\n')
}

/** The seller's one-tap answers, kept as the resolution note. */
export const ORDER_TAKEN = 'Pedido cargado'
export const NOT_MINE = 'No corresponde'

/** A link that opens WhatsApp with the text, to pick the chat (no number needed). */
export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`

/** "06/11 14:30" in Argentina. */
export function issueWhen(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso))
  const part = (t: string) => (parts.find((p) => p.type === t)?.value ?? '').padStart(2, '0')
  return `${part('day')}/${part('month')} ${part('hour')}:${part('minute')}`
}

const AR = 'America/Argentina/Buenos_Aires'

/** The day it was reported, in Argentina: '2026-11-24'. */
export function issueDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: AR, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

/** "14:30" in Argentina. */
export function issueTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: AR, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}

/** A day's heading: "Hoy", "Ayer", or "Lunes 23 de noviembre". */
export function dayTitle(day: string, today: string, longDate: (d: string) => string): string {
  if (day === today) return 'Hoy'
  const yesterday = new Date(`${today}T12:00:00Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  return day === yesterday.toISOString().slice(0, 10) ? 'Ayer' : longDate(day)
}

export interface IssueGroup<T> {
  key: string
  title: string
  items: T[]
}

/**
 * The novedades in sections: by the day they were reported (newest first, as they come) or
 * by type (in the company's order of types, each newest first).
 */
export function groupIssues<T extends { createdAt: string; typeId: number }>(
  list: readonly T[], by: 'day' | 'type', title: { day: (day: string) => string; type: (id: number) => string }, typeOrder: readonly number[] = [],
): IssueGroup<T>[] {
  const groups = new Map<string, IssueGroup<T>>()
  for (const i of list) {
    const key = by === 'day' ? issueDay(i.createdAt) : String(i.typeId)
    const g = groups.get(key) ?? { key, title: by === 'day' ? title.day(key) : title.type(i.typeId), items: [] }
    g.items.push(i)
    groups.set(key, g)
  }
  const out = [...groups.values()]
  if (by === 'type') {
    const at = (k: string) => { const n = typeOrder.indexOf(Number(k)); return n < 0 ? Number.MAX_SAFE_INTEGER : n }
    out.sort((a, b) => at(a.key) - at(b.key))
  }
  return out
}

/** Reported after the last time this person opened the list: marked "Nueva". */
export const isNewIssue = (createdAt: string, lastSeen: string | null) => lastSeen !== null && createdAt > lastSeen
