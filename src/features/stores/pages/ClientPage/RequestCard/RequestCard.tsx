import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, CalendarPlus, Clock, Send, XCircle } from 'lucide-react'
import { formatDayMonth } from '@/domain/dates'
import { issueWhen } from '@/domain/issues'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import { TextArea } from '@/ui/TextArea'
import { clientRequestQuery, useActivationRequests } from '@/features/stores/api/activation-requests'
import styles from './RequestCard.module.scss'

/**
 * The seller asks to activate this client (a launch, a new display, a client dropping):
 * the supervisor schedules it in someone's day, or answers why not.
 */
export function RequestCard({ storeId, place }: { storeId: string; place: string }) {
  const request = useQuery(clientRequestQuery(storeId))
  const { ask, cancel } = useActivationRequests()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const r = request.data
  if (request.isPending) return null

  const send = () => ask.mutate({ storeId, note }, { onSuccess: () => setOpen(false) })
  const button = <Button variant="secondary" onClick={() => { setNote(''); setOpen(true) }}><CalendarPlus size={20} aria-hidden />Pedir una activación</Button>

  return (
    <section className={styles.card} aria-label="Pedido de activación">
      {r?.status === 'open' ? (
        <>
          <p className={styles.state}><Clock size={18} aria-hidden />Pediste una activación el {issueWhen(r.createdAt).split(' ')[0]}. Esperando al supervisor.</p>
          {r.note ? <p className={styles.note}>{r.note}</p> : null}
          <Button variant="ghost" size="sm" loading={cancel.isPending} onClick={() => cancel.mutate(r.id)} className={styles.cancel}>Quitar el pedido</Button>
        </>
      ) : r?.status === 'scheduled' ? (
        <>
          <p className={styles.state} data-tone="ok"><CalendarCheck size={18} aria-hidden />Tu pedido quedó agendado{r.scheduledFor ? ` para el ${formatDayMonth(r.scheduledFor)}` : ''}{r.scheduledWith ? `, con ${r.scheduledWith}` : ''}.</p>
          {button}
        </>
      ) : r?.status === 'dismissed' ? (
        <>
          <p className={styles.state} data-tone="off"><XCircle size={18} aria-hidden />El supervisor no agendó tu último pedido{r.answer ? `: ${r.answer}` : '.'}</p>
          {button}
        </>
      ) : (
        <>
          <p className={styles.help}>¿Hay un lanzamiento, una exhibición nueva o el cliente se está cayendo? Pedí que lo activen.</p>
          {button}
        </>
      )}
      {cancel.error ? <Banner tone="error">{cancel.error.message}</Banner> : null}

      <Sheet open={open} onClose={() => setOpen(false)} title="Pedir una activación" subtitle={place}
        footer={<>
          <Button variant="secondary" size="md" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button size="md" loading={ask.isPending} onClick={send}><Send size={18} aria-hidden />Mandar al supervisor</Button>
        </>}>
        <div className={styles.form}>
          <TextArea label="¿Para qué? (opcional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={3} placeholder="Ej.: lanzamiento de Aperol, armar la puntera" />
          <p className={styles.help}>Le llega al supervisor en Asignar. Cuando lo sume a la jornada de un activador, lo ves acá.</p>
          {ask.error ? <Banner tone="error">{ask.error.message}</Banner> : null}
        </div>
      </Sheet>
    </section>
  )
}
