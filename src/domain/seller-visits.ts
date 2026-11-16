// The seller's own visits: how each one went and, with an order, what the client asked for
// (no prices: those live in the distributor's system). Also how the month is going.

export type SellerOutcome = 'order' | 'no_order' | 'closed'

export const OUTCOME_LABEL: Record<SellerOutcome, string> = { order: 'Con pedido', no_order: 'Sin pedido', closed: 'Cerrado' }

/** Why there was no order: the usual answers, one tap each. */
export const NO_ORDER_REASONS = ['Tiene stock', 'No estaba el encargado', 'Sin presupuesto', 'Le compra a otro', 'Otro'] as const

export interface OrderLine {
  qty: number
  item: string
}

export const MAX_QTY = 9999
export const MAX_ITEM = 80

/** The lines worth sending: with a product, a quantity from 1 to 9999, trimmed. */
export function cleanLines(lines: readonly OrderLine[]): OrderLine[] {
  return lines
    .map((l) => ({ qty: Math.min(MAX_QTY, Math.max(1, Math.round(l.qty) || 1)), item: l.item.trim().slice(0, MAX_ITEM) }))
    .filter((l) => l.item.length > 0)
}

export interface OrderNote {
  store: { name: string | null; address: string; customerNumber: string | null }
  lines: readonly OrderLine[]
  note: string | null
  seller: string
  /** "16/11" */
  date: string
}

/** The order as a message, ready for WhatsApp (to the distributor, the client or a colleague). */
export function orderMessage(o: OrderNote): string {
  const title = [o.store.name ?? o.store.address, o.store.customerNumber ? `Cliente ${o.store.customerNumber}` : null].filter(Boolean).join(' · ')
  return [
    `*Pedido · ${title}*`,
    o.store.name ? o.store.address : null,
    '',
    ...cleanLines(o.lines).map((l) => `• ${l.qty} × ${l.item}`),
    o.note ? `\nNota: ${o.note}` : null,
    `\n— ${o.seller.split(' ')[0]}, ${o.date}`,
  ].filter((l) => l !== null).join('\n')
}

/** Products already asked for and the company's brands, without repeats, to suggest while typing. */
export function itemSuggestions(previous: readonly OrderLine[], brands: readonly string[]): string[] {
  const seen = new Set<string>()
  return [...previous.map((l) => l.item), ...brands].filter((s) => {
    const k = s.trim().toLowerCase()
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** 0 to 100, for "visited 12 of 41 clients" or "18 of 60 visits". */
export const percent = (done: number, total: number) => (total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0)

/**
 * A monthly target for a period: the target itself for one whole month, in proportion to
 * the days (out of 30) otherwise. At least 1.
 */
export function periodTarget(monthly: number, from: string, to: string): number {
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
  const end = new Date(Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)), 0)).toISOString().slice(0, 10)
  if (from.endsWith('-01') && to === end) return monthly
  return Math.max(1, Math.round((monthly * days) / 30))
}
