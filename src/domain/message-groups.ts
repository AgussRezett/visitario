/**
 * How the ANTES and the DESPUÉS go to WhatsApp, each chosen on its own by the company:
 * one message for the whole visit, one per display (Puntera, Primaria 1, Primaria 2…),
 * or one per kind of display with the photos of all of them (Puntera, Primarias, Góndolas).
 */
import { displayLabels } from './templates'

export type MessageGrouping = 'visit' | 'display' | 'type'

export const GROUPINGS: readonly { value: MessageGrouping; label: string; help: string }[] = [
  { value: 'visit', label: 'Uno para toda la visita', help: 'Un solo mensaje con las fotos de todas las exhibiciones.' },
  { value: 'type', label: 'Uno por tipo de exhibición', help: 'Ej.: una puntera, dos primarias y tres góndolas son tres mensajes.' },
  { value: 'display', label: 'Uno por cada exhibición', help: 'Cada exhibición con su mensaje y sus fotos.' },
]

export const isGrouping = (v: unknown): v is MessageGrouping => v === 'visit' || v === 'display' || v === 'type'

/** One message: its key, its name (null when it is the whole visit), its displays (null: all), and what {exhibiciones} says. */
export interface MessageGroup {
  key: string
  label: string | null
  displayIds: string[] | null
  /** "Puntera", "3 Góndola"; undefined: the whole visit's list. */
  displays?: string
}

/** The messages a visit's displays make. With no displays, one for the visit, whatever the setting. */
export function messageGroups(displays: readonly { id: string; typeId: number; name: string }[], grouping: MessageGrouping): MessageGroup[] {
  if (grouping === 'visit' || !displays.length) return [{ key: 'visit', label: null, displayIds: null }]
  if (grouping === 'display') {
    const labels = displayLabels(displays.map((d) => d.name))
    return displays.map((d, i) => ({ key: d.id, label: labels[i] ?? d.name, displayIds: [d.id], displays: d.name }))
  }
  const byType = new Map<number, { name: string; ids: string[] }>()
  for (const d of displays) {
    const t = byType.get(d.typeId) ?? { name: d.name, ids: [] }
    t.ids.push(d.id)
    byType.set(d.typeId, t)
  }
  return [...byType].map(([typeId, t]) => ({
    key: `type-${typeId}`,
    label: t.ids.length > 1 ? `${t.name} (${t.ids.length})` : t.name,
    displayIds: t.ids,
    displays: t.ids.length > 1 ? `${t.ids.length} ${t.name}` : t.name,
  }))
}
