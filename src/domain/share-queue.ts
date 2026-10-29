/**
 * Sending a visit to WhatsApp: one share per message, each with its photos and its text.
 * The order is the one the supervisor expects: the storefront with the address, then the
 * ANTES (one per display when the company sends per display), then the DESPUÉS, and last
 * the observations (text only, when the activador wrote any).
 */

type PhotoKind = 'storefront' | 'before' | 'after'
export type SendGroup = PhotoKind | 'notes'

export interface Send {
  key: string
  group: SendGroup
  /** The row's name inside its group: "Góndola 1", or "ANTES" when it is one per visit. */
  title: string
  /** What the main button says: "ANTES · Góndola 1". */
  label: string
  photoIds: string[]
  text: string
  /** Goes without photos (the observations). */
  textOnly?: boolean
}

/** The observations as the supervisor reads them: Observaciones: …. */
export function observationText(notes: string | null | undefined): string | null {
  const text = notes?.trim()
  return text ? `Observaciones: ${text}` : null
}

export interface SendInput {
  address: string
  photos: readonly { id: string; kind: PhotoKind; displayId: string | null }[]
  /** One message pair per display; null when the company sends one per visit. */
  displays: readonly { id: string; label: string; before: string; after: string }[] | null
  general: { before: string; after: string }
  /** What the activador wrote; nothing to send when empty. */
  notes?: string | null
}

const WORD: Record<'before' | 'after', string> = { before: 'ANTES', after: 'DESPUÉS' }

export function buildSends(input: SendInput): Send[] {
  const of = (kind: PhotoKind, displayId?: string) =>
    input.photos.filter((p) => p.kind === kind && (displayId === undefined || p.displayId === displayId)).map((p) => p.id)
  const sends: Send[] = [{ key: 'storefront', group: 'storefront', title: 'Fachada', label: 'Fachada', photoIds: of('storefront'), text: input.address }]
  for (const kind of ['before', 'after'] as const) {
    if (input.displays) {
      for (const d of input.displays) {
        sends.push({ key: `${kind}-${d.id}`, group: kind, title: d.label, label: `${WORD[kind]} · ${d.label}`, photoIds: of(kind, d.id), text: d[kind] })
      }
    } else {
      sends.push({ key: kind, group: kind, title: WORD[kind], label: WORD[kind], photoIds: of(kind), text: input.general[kind] })
    }
  }
  const notes = observationText(input.notes)
  if (notes) sends.push({ key: 'notes', group: 'notes', title: 'Observaciones', label: 'Observaciones', photoIds: [], text: notes, textOnly: true })
  return sends
}

/** Ready to send: it has its photos (or needs none). */
export const isReady = (s: Send) => Boolean(s.textOnly) || s.photoIds.length > 0

/** The next one to send: the first ready one not sent yet. */
export const nextSend = (sends: readonly Send[], sent: ReadonlySet<string>) => sends.find((s) => isReady(s) && !sent.has(s.key)) ?? null

/** "ANTES - Góndola 1.jpg", "Fachada 2.jpg": what WhatsApp shows if it shows a name. */
export function shareFileName(s: Send, index: number) {
  const base = s.label.replace(' · ', ' - ').replace(/[\\/:*?"<>|]/g, '')
  return `${base}${index > 0 ? ` ${index + 1}` : ''}.jpg`
}
