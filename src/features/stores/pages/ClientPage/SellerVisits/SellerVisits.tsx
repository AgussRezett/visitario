import { useQuery } from '@tanstack/react-query'
import { MessageCircle, Trash2 } from 'lucide-react'
import { issueWhen, whatsappLink } from '@/domain/issues'
import { OUTCOME_LABEL, orderMessage } from '@/domain/seller-visits'
import { todayInArgentina } from '@/domain/dates'
import { buttonClass } from '@/ui/Button'
import { useConfirm } from '@/ui/ConfirmDialog'
import { sellerVisitsQuery, useSellerVisits } from '@/features/stores/api/seller-visits'
import styles from './SellerVisits.module.scss'

interface SellerVisitsProps {
  storeId: string
  store: { name: string | null; address: string; customerNumber: string | null }
  me: string
}

const dayOf = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

/** The seller's own visits to this client: how each went, and the order, to send by WhatsApp. */
export function SellerVisits({ storeId, store, me }: SellerVisitsProps) {
  const visits = useQuery(sellerVisitsQuery(storeId))
  const { remove } = useSellerVisits()
  const { confirm, dialog } = useConfirm()
  const list = visits.data ?? []
  if (!list.length) return null
  const today = todayInArgentina()

  const drop = async (id: string) => {
    if (await confirm({ title: '¿Quitar esta visita?', description: 'Deja de contar en tu cobertura del mes.', confirmLabel: 'Quitar', tone: 'danger' })) remove.mutate(id)
  }

  return (
    <section className={styles.section} aria-label="Mis visitas">
      <h2 className={styles.title}>Mis visitas</h2>
      <ul className={styles.list}>
        {list.map((v) => (
          <li key={v.id} className={styles.item}>
            <div className={styles.head}>
              <span className={styles.outcome} data-outcome={v.outcome}>{OUTCOME_LABEL[v.outcome]}</span>
              <span className={styles.when}>{issueWhen(v.visitedAt)}</span>
            </div>
            {v.reason ? <span className={styles.text}>{v.reason}</span> : null}
            {v.lines.length ? (
              <ul className={styles.lines} aria-label="Pedido">
                {v.lines.map((l, i) => <li key={i}><b>{l.qty} ×</b> {l.item}</li>)}
              </ul>
            ) : null}
            {v.note ? <span className={styles.note}>{v.note}</span> : null}
            <div className={styles.actions}>
              {v.lines.length ? (
                <a className={buttonClass('secondary', 'sm')} target="_blank" rel="noreferrer"
                  href={whatsappLink(orderMessage({ store, lines: v.lines, note: v.note, seller: me, date: issueWhen(v.visitedAt).split(' ')[0] ?? '' }))}>
                  <MessageCircle size={16} aria-hidden />Mandar el pedido
                </a>
              ) : null}
              {dayOf(v.visitedAt) === today ? (
                <button type="button" className={styles.remove} onClick={() => void drop(v.id)} aria-label={`Quitar la visita de ${issueWhen(v.visitedAt)}`}><Trash2 size={18} aria-hidden /></button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {dialog}
    </section>
  )
}
