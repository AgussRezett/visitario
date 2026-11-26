/**
 * Sending a visit to WhatsApp: one share per message, each with its photos and its text.
 * The order is the one the supervisor expects: the storefront with the address, then the
 * ANTES, then the DESPUÉS (each as the company groups it: one for the visit, one per display
 * or one per kind of display; see message-groups), and last the observations (text only,
 * when the activador wrote any).
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
  /** Goes without photos (the observations, or the text of an album). */
  textOnly?: boolean
  /** The text of an album: goes right after its photos, as its own message. */
  ofAlbum?: string
}

/** The observations as the supervisor reads them: Observaciones: …. */
export function observationText(notes: string | null | undefined): string | null {
  const text = notes?.trim()
  return text ? `Observaciones: ${text}` : null
}

/** One ANTES or DESPUÉS message: its key and name (see MessageGroup), its displays (null: all) and its text. */
export interface SendMessage {
  key: string
  label: string | null
  displayIds: string[] | null
  text: string
}

export interface SendInput {
  address: string
  photos: readonly { id: string; kind: PhotoKind; displayId: string | null }[]
  before: readonly SendMessage[]
  after: readonly SendMessage[]
  /** What the activador wrote; nothing to send when empty. */
  notes?: string | null
}

const WORD: Record<'before' | 'after', string> = { before: 'ANTES', after: 'DESPUÉS' }

/**
 * With more than one photo the text goes apart, as its own message right after them: shared
 * with the photos, WhatsApp would repeat it on every photo.
 */
export const albumCaption = (photos: number) => photos > 1

export function buildSends(input: SendInput): Send[] {
  const of = (kind: PhotoKind, displayIds: readonly string[] | null) =>
    input.photos.filter((p) => p.kind === kind && (displayIds === null || (p.displayId !== null && displayIds.includes(p.displayId)))).map((p) => p.id)
  const sends: Send[] = [{ key: 'storefront', group: 'storefront', title: 'Fachada', label: 'Fachada', photoIds: of('storefront', null), text: input.address }]
  for (const kind of ['before', 'after'] as const) {
    for (const m of input[kind]) {
      // The whole visit keeps its old key ("before"), each display too ("before-<id>"): what was sent stays sent.
      const key = m.label === null ? kind : `${kind}-${m.key}`
      const title = m.label ?? WORD[kind]
      const label = m.label === null ? WORD[kind] : `${WORD[kind]} · ${m.label}`
      const photoIds = of(kind, m.displayIds)
      if (!albumCaption(photoIds.length) || !m.text) {
        sends.push({ key, group: kind, title, label, photoIds, text: m.text })
        continue
      }
      sends.push({ key, group: kind, title, label, photoIds, text: '' })
      sends.push({ key: `${key}-text`, group: kind, title: `${title} · texto`, label: `texto de ${label}`, photoIds: [], text: m.text, textOnly: true, ofAlbum: key })
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
