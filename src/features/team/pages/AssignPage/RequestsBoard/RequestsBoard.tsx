import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarPlus, Megaphone, X } from 'lucide-react'
import { formatDayMonth } from '@/domain/dates'
import { issueWhen } from '@/domain/issues'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import { TextArea } from '@/ui/TextArea'
import { openRequestsQuery, useActivationRequests, type ActivationRequest } from '@/features/stores/api/activation-requests'
import styles from './RequestsBoard.module.scss'

interface RequestsBoardProps {
  companyId: string
  /** The merchandiser and the day being planned: a request is added there. */
  member: { personId: string; firstName: string } | undefined
  date: string
}

/** What the sellers asked to activate, to add to the day being planned or to dismiss with a reason. */
export function RequestsBoard({ companyId, member, date }: RequestsBoardProps) {
  const requests = useQuery(openRequestsQuery(companyId))
  const { schedule, dismiss } = useActivationRequests()
  const [dismissing, setDismissing] = useState<ActivationRequest | null>(null)
  const [answer, setAnswer] = useState('')
  const list = requests.data ?? []
  if (!list.length) return null

  return (
    <section className={styles.board} aria-label="Pedidos de vendedores">
      <h2 className={styles.title}><Megaphone size={18} aria-hidden />Pedidos de vendedores · {list.length}</h2>
      <ul className={styles.list}>
        {list.map((r) => (
          <li key={r.id} className={styles.item}>
            <span className={styles.text}>
              <span className={styles.place}>{r.store.name ?? r.store.address}</span>
              <span className={styles.meta}>{[r.store.name ? r.store.address : null, r.store.area, r.store.customerNumber && `Cliente ${r.store.customerNumber}`].filter(Boolean).join(' · ')}</span>
              {r.note ? <span className={styles.note}>{r.note}</span> : null}
              <span className={styles.meta}>Lo pidió {r.by} el {issueWhen(r.createdAt)}</span>
            </span>
            <span className={styles.actions}>
              {member ? (
                <Button size="sm" loading={schedule.isPending && schedule.variables?.id === r.id} onClick={() => schedule.mutate({ id: r.id, merchandiserId: member.personId, date })}>
                  <CalendarPlus size={16} aria-hidden />Sumar a {member.firstName} el {formatDayMonth(date)}
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={() => { setAnswer(''); setDismissing(r) }}><X size={16} aria-hidden />Descartar</Button>
            </span>
          </li>
        ))}
      </ul>
      {schedule.error ? <Banner tone="error">{schedule.error.message}</Banner> : null}

      <Sheet open={Boolean(dismissing)} onClose={() => setDismissing(null)} title="Descartar el pedido" subtitle={dismissing ? dismissing.store.name ?? dismissing.store.address : ''}
        footer={<>
          <Button variant="secondary" size="md" onClick={() => setDismissing(null)}>Cancelar</Button>
          <Button size="md" loading={dismiss.isPending} onClick={() => dismissing && dismiss.mutate({ id: dismissing.id, answer }, { onSuccess: () => setDismissing(null) })}>Descartar</Button>
        </>}>
        <TextArea label="Motivo para el vendedor (opcional)" value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={300} rows={3} placeholder="Ej.: ya se activó la semana pasada" />
        {dismiss.error ? <Banner tone="error">{dismiss.error.message}</Banner> : null}
      </Sheet>
    </section>
  )
}
