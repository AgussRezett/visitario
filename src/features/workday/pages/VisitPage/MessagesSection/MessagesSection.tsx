import { Check, Copy, MessageSquare, Share2 } from 'lucide-react'
import { fillTemplate, type TemplateKind } from '@/domain/templates'
import { canShare, share, useCopy } from '@/lib/share'
import { Button } from '@/ui/Button'
import type { Visit } from '@/features/workday/api/queries'
import { localPhotoBlob } from '@/features/workday/api/photos'
import { VisitSection } from '@/features/workday/components/VisitSection'
import { displayMessageValues, messageValues } from '@/features/workday/visit-text'
import type { StoreTags } from '@/features/workday/store-tags'
import styles from './MessagesSection.module.scss'

interface MessagesSectionProps {
  visit: Visit
  templates: Record<TemplateKind, string>
  firstName: string
  typeName?: (id: number) => string
  tags?: StoreTags
  /** The company sends one ANTES / DESPUÉS per display. */
  perDisplay?: boolean
}

interface Item {
  key: string
  label: string
  /** For screen readers: "Copiar ANTES de Puntera". */
  name: string
  text: string
}

/** The ANTES / DESPUÉS messages, while WhatsApp is still the bridge with the supervisor. */
export function MessagesSection({ visit: v, templates, firstName, typeName, tags, perDisplay = false }: MessagesSectionProps) {
  const { copied, copy } = useCopy()
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
  const storefront = v.photos.find((p) => p.kind === 'storefront')

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
      {canShare() ? (
        <Button
          variant="ghost"
          size="sm"
          className={styles.share}
          onClick={() => {
            const blob = storefront ? localPhotoBlob(storefront.id) : undefined
            void share({ text: v.store.address, files: blob ? [new File([blob], 'fachada.jpg', { type: 'image/jpeg' })] : undefined })
          }}
        >
          <Share2 size={16} aria-hidden />Compartir fachada y dirección
        </Button>
      ) : null}
    </VisitSection>
  )
}
