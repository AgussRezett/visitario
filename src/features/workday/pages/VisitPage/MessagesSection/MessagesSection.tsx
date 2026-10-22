import { useState } from 'react'
import { Check, ChevronRight, Copy, MessageSquare, Send as SendIcon } from 'lucide-react'
import { buildSends } from '@/domain/share-queue'
import { fillTemplate, type TemplateKind } from '@/domain/templates'
import { canShare, useCopy } from '@/lib/share'
import { Button } from '@/ui/Button'
import type { Visit } from '@/features/workday/api/queries'
import { VisitSection } from '@/features/workday/components/VisitSection'
import { displayMessageValues, messageValues } from '@/features/workday/visit-text'
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
  /** The company sends one ANTES / DESPUÉS per display. */
  perDisplay?: boolean
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
export function MessagesSection({ visit: v, templates, firstName, typeName, tags, perDisplay = false, urlFor }: MessagesSectionProps) {
  const { copied, copy } = useCopy()
  const [sending, setSending] = useState(false)
  const { sent, mark } = useSent(v.id)
  const address: Item = { key: 'address', label: 'Dirección', name: 'Copiar Dirección', text: v.store.address }
  const values = messageValues(v, firstName, typeName, tags)
  const general: Item[] = [
    address,
    { key: 'before', label: 'ANTES', name: 'Copiar ANTES', text: fillTemplate(templates.before, values) },
    { key: 'after', label: 'DESPUÉS', name: 'Copiar DESPUÉS', text: fillTemplate(templates.after, values) },
  ]
  const byDisplay = perDisplay
    ? displayMessageValues(v, firstName, typeName, tags).map((d) => ({
        id: d.id,
        label: d.label,
        items: [
          { key: `before-${d.id}`, label: 'ANTES', name: `Copiar ANTES de ${d.label}`, text: fillTemplate(templates.before, d.values) },
          { key: `after-${d.id}`, label: 'DESPUÉS', name: `Copiar DESPUÉS de ${d.label}`, text: fillTemplate(templates.after, d.values) },
        ],
      }))
    : []
  const sends = buildSends({
    address: v.store.address,
    photos: v.photos,
    displays: perDisplay ? byDisplay.map((d) => ({ id: d.id, label: d.label, before: d.items[0]?.text ?? '', after: d.items[1]?.text ?? '' })) : null,
    general: { before: general[1]?.text ?? '', after: general[2]?.text ?? '' },
  })
  const done = sends.filter((s) => sent.has(s.key)).length

  const button = (i: Item, size: 'sm' | 'md' = 'sm') => (
    <Button key={i.key} variant="secondary" size={size} className={styles.copy} onClick={() => copy(i.key, i.text)} aria-label={i.name}>
      {copied === i.key ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      {copied === i.key ? 'Copiado' : i.label}
    </Button>
  )

  return (
    <VisitSection
      state="todo"
      icon={<MessageSquare size={16} />}
      title="Mensajes para WhatsApp"
      subtitle={perDisplay ? 'Dirección · ANTES y DESPUÉS de cada exhibición' : 'Dirección · ANTES · DESPUÉS'}
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
          <SendSheet open={sending} onClose={() => setSending(false)} address={v.store.address} sends={sends} sent={sent} onSent={mark} urlFor={urlFor} />
        </>
      ) : null}
      {perDisplay ? (
        <>
          <div className={styles.address}>{button(address)}</div>
          {byDisplay.length ? (
            <ul className={styles.displays} aria-label="Mensajes por exhibición">
              {byDisplay.map((d) => (
                <li key={d.id} className={styles.display}>
                  <span className={styles.displayName}>{d.label}</span>
                  <div className={styles.pair}>{d.items.map((i) => button(i, 'md'))}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.help}>Agregá una exhibición y vas a tener su ANTES y su DESPUÉS para copiar.</p>
          )}
        </>
      ) : (
        <div className={styles.buttons}>{general.map((i) => button(i))}</div>
      )}
    </VisitSection>
  )
}
