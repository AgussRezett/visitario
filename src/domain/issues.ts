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
