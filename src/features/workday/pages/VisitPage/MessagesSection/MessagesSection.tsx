import { useState } from 'react'
import clsx from 'clsx'
import { Check, ChevronRight, Copy, MessageSquare, Send as SendIcon } from 'lucide-react'
import { buildSends, observationText } from '@/domain/share-queue'
import { fillTemplate, type TemplateKind } from '@/domain/templates'
import { canShare, useCopy } from '@/lib/share'
import { Button } from '@/ui/Button'
import type { Visit } from '@/features/workday/api/queries'
import { VisitSection } from '@/features/workday/components/VisitSection'
import { groupMessageValues } from '@/features/workday/visit-text'
import type { MessageGrouping } from '@/domain/message-groups'
import type { StoreTags } from '@/features/workday/store-tags'
import { SendSheet } from '../SendSheet'
import { useSent } from '../SendSheet/sent'
import styles from './MessagesSection.module.scss'

interface MessagesSectionProps {
  visit: Visit
  templates: Record<TemplateKind, string>
  firstName: string
  typeName?: (id: number) => string
  tags?: StoreTags
  /** How the company groups the ANTES and the DESPUÉS: per visit, per display or per kind of display. */
  before?: MessageGrouping
  after?: MessageGrouping
  urlFor: (id: string) => string | undefined
}

interface Item {
  key: string
  label: string
  /** For screen readers: "Copiar ANTES de Puntera". */
  name: string
  text: string
}

/** The ANTES / DESPUÉS messages, while WhatsApp is still the bridge with the supervisor. */
export function MessagesSection({ visit: v, templates, firstName, typeName, tags, before = 'visit', after = 'visit', urlFor }: MessagesSectionProps) {
  const { copied, copy } = useCopy()
  const [sending, setSending] = useState(false)
  const { sent, mark } = useSent(v.id)
  const address: Item = { key: 'address', label: 'Dirección', name: 'Copiar Dirección', text: v.store.address }
  const notesText = observationText(v.notes)
  const notes: Item | null = notesText ? { key: 'notes', label: 'Observaciones', name: 'Copiar Observaciones', text: notesText } : null
  // The ANTES and the DESPUÉS, each grouped as the company says, with its text filled in.
  const messages = (kind: 'before' | 'after', grouping: MessageGrouping) =>
    groupMessageValues(v, firstName, grouping, typeName, tags).map((g) => ({ key: g.key, label: g.label, displayIds: g.displayIds, text: fillTemplate(templates[kind], g.values) }))
  const antes = { kind: 'before' as const, word: 'ANTES', list: messages('before', before) }
  const despues = { kind: 'after' as const, word: 'DESPUÉS', list: messages('after', after) }
  const kinds = [antes, despues]
  const items = (k: typeof antes | typeof despues): Item[] => k.list.map((m) => ({
    key: m.label === null ? k.kind : `${k.kind}-${m.key}`,
    label: m.label ?? k.word,
    name: m.label === null ? `Copiar ${k.word}` : `Copiar ${k.word} de ${m.label}`,
    text: m.text,
  }))
  const grouped = kinds.some((k) => k.list.length > 1 || k.list[0]?.label)
  const sends = buildSends({ address: v.store.address, photos: v.photos, before: antes.list, after: despues.list, notes: v.notes })
  const done = sends.filter((s) => sent.has(s.key)).length

  const button = (i: Item, size: 'sm' | 'md' = 'sm', wide = false) => (
    <Button key={i.key} variant="secondary" size={size} className={clsx(styles.copy, wide && styles.wide)} onClick={() => copy(i.key, i.text)} aria-label={i.name}>
      {copied === i.key ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      {copied === i.key ? 'Copiado' : i.label}
    </Button>
  )

  return (
    <VisitSection
      state="todo"
      icon={<MessageSquare size={16} />}
      title="Mensajes para WhatsApp"
      subtitle={`Dirección · ${kinds.map((k) => `${k.word}${k.list.length > 1 ? ` (${k.list.length})` : ''}`).join(' · ')}${notes ? ' · Observaciones' : ''}`}
    >
      {canShare() ? (
        <>
          <button type="button" className={styles.send} onClick={() => setSending(true)}>
            <span className={styles.sendIcon} aria-hidden><SendIcon size={20} /></span>
            <span className={styles.sendTexts}>
              <span className={styles.sendTitle}>Enviar a WhatsApp</span>
              <span className={styles.sendMeta}>{done === 0 ? 'Fotos y mensaje de cada una, en orden' : done === sends.length ? 'Todo enviado' : `${done} de ${sends.length} enviados`}</span>
            </span>
            <ChevronRight size={20} className={styles.chevron} aria-hidden />
          </button>
          <span className={styles.or}>O copiá solo el texto</span>
          <SendSheet open={sending} onClose={() => setSending(false)} address={v.store.address} sends={sends} sent={sent} onSent={mark} urlFor={urlFor} frameFor={(id) => v.photos.find((p) => p.id === id)} />
        </>
      ) : null}
      {grouped ? (
        <>
          <div className={styles.address}>{button(address)}{notes ? button(notes, 'sm', true) : null}</div>
          <ul className={styles.displays} aria-label="Mensajes por exhibición">
            {kinds.map((k) => (
              <li key={k.kind} className={styles.display}>
                <span className={styles.displayName}>{k.word}</span>
                <div className={styles.pair}>{items(k).map((i) => button(i, 'md'))}</div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className={styles.buttons}>{[address, ...items(antes), ...items(despues)].map((i) => button(i))}{notes ? button(notes, 'sm', true) : null}</div>
      )}
      {!notes ? <p className={styles.help}>Si escribís observaciones en la visita, también las vas a poder copiar y enviar.</p> : null}
    </VisitSection>
  )
}
