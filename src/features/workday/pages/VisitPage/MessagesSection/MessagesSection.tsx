import { Check, Copy, MessageSquare, Share2 } from 'lucide-react'
import { fillTemplate, type TemplateKind } from '@/domain/templates'
import { canShare, share, useCopy } from '@/lib/share'
import { Button } from '@/ui/Button'
import type { Visit } from '@/features/workday/api/queries'
import { localPhotoBlob } from '@/features/workday/api/photos'
import { VisitSection } from '@/features/workday/components/VisitSection'
import { messageValues } from '@/features/workday/visit-text'
import styles from './MessagesSection.module.scss'

/** The ANTES / DESPUÉS messages, while WhatsApp is still the bridge with the supervisor. */
export function MessagesSection({ visit: v, templates, firstName }: { visit: Visit; templates: Record<TemplateKind, string>; firstName: string }) {
  const { copied, copy } = useCopy()
  const values = messageValues(v, firstName)
  const items: { key: string; label: string; text: string }[] = [
    { key: 'address', label: 'Dirección', text: v.store.address },
    { key: 'before', label: 'ANTES', text: fillTemplate(templates.before, values) },
    { key: 'after', label: 'DESPUÉS', text: fillTemplate(templates.after, values) },
  ]
  const storefront = v.photos.find((p) => p.kind === 'storefront')

  return (
    <VisitSection state="todo" icon={<MessageSquare size={16} />} title="Mensajes para WhatsApp" subtitle="Dirección · ANTES · DESPUÉS">
      <div className={styles.buttons}>
        {items.map((i) => (
          <Button key={i.key} variant="secondary" size="sm" className={styles.copy} onClick={() => copy(i.key, i.text)} aria-label={`Copiar ${i.label}`}>
            {copied === i.key ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
            {copied === i.key ? 'Copiado' : i.label}
          </Button>
        ))}
      </div>
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
