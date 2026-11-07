import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { CheckCircle2, ChevronRight, MessageCircle, RotateCcw } from 'lucide-react'
import { issueWhen, sellerMessage, whatsappLink } from '@/domain/issues'
import { Button, buttonClass } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import { TextArea } from '@/ui/TextArea'
import type { StoreIssue } from '@/features/issues/api'
import styles from './IssueCard.module.scss'

interface IssueCardProps {
  issue: StoreIssue
  typeName: string
  seller: string | null
  channel: string | null
  busy: boolean
  onResolve: (note: string) => Promise<unknown>
  onReopen: () => void
}

/** One novedad: what, where, who saw it; to pass it to the seller and mark it resolved. */
export function IssueCard({ issue: i, typeName, seller, channel, busy, onResolve, onReopen }: IssueCardProps) {
  const [resolving, setResolving] = useState(false)
  const [note, setNote] = useState('')
  const when = issueWhen(i.createdAt)
  const message = sellerMessage({ type: typeName, note: i.note, store: i.store, by: i.by, when }, seller)
  const place = i.store.name ?? i.store.address

  return (
    <article className={styles.card} aria-label={`${typeName}: ${place}`}>
      <div className={styles.top}>
        <span className={styles.type}>{typeName}</span>
        <span className={styles.when}>{when}</span>
      </div>
      <div className={styles.store}>
        <span className={styles.place}>{place}</span>
        <span className={styles.meta}>
          {[i.store.name ? i.store.address : null, i.store.area, i.store.customerNumber && `Cliente ${i.store.customerNumber}`, channel, seller && `vend. ${seller}`].filter(Boolean).join(' · ')}
        </span>
      </div>
      {i.note ? <p className={styles.note}>{i.note}</p> : null}
      <span className={styles.by}>Lo reportó {i.by}</span>
      {i.status === 'resolved' ? (
        <p className={styles.resolved}><CheckCircle2 size={16} aria-hidden />Resuelta{i.resolvedBy ? ` por ${i.resolvedBy}` : ''}{i.resolvedAt ? ` el ${issueWhen(i.resolvedAt)}` : ''}{i.resolution ? `: ${i.resolution}` : ''}</p>
      ) : null}
      <div className={styles.actions}>
        {i.status === 'open' ? (
          <>
            <a className={buttonClass('secondary', 'sm')} href={whatsappLink(message)} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden />{seller ? 'Mandar al vendedor' : 'Mandar por WhatsApp'}</a>
            <Button size="sm" onClick={() => { setNote(''); setResolving(true) }}><CheckCircle2 size={16} aria-hidden />Marcar resuelta</Button>
          </>
        ) : (
          <Button variant="secondary" size="sm" loading={busy} onClick={onReopen}><RotateCcw size={16} aria-hidden />Volver a abrir</Button>
        )}
        <Link to="/review/$visitId" params={{ visitId: i.visitId }} search={{ from: '/s/issues' }} className={buttonClass('ghost', 'sm', styles.visit)}>Ver la visita<ChevronRight size={16} aria-hidden /></Link>
      </div>

      <Sheet open={resolving} onClose={() => setResolving(false)} title="Marcar resuelta" subtitle={`${typeName} · ${place}`}
        footer={<>
          <Button variant="secondary" size="md" onClick={() => setResolving(false)}>Cancelar</Button>
          <Button size="md" loading={busy} onClick={() => void onResolve(note).then(() => setResolving(false))}>Marcar resuelta</Button>
        </>}>
        <TextArea label="Qué se hizo (opcional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={3} placeholder="Ej.: pedido cargado por Florencia" />
      </Sheet>
    </article>
  )
}
