import { useState } from 'react'
import { Megaphone, Plus, Trash2 } from 'lucide-react'
import { formatTime } from '@/domain/dates'
import { Button } from '@/ui/Button'
import { useConfirm } from '@/ui/ConfirmDialog'
import type { Catalogs } from '@/features/workday/api/catalogs'
import type { Visit } from '@/features/workday/api/queries'
import { visitChanges } from '@/features/sync/changes'
import { useVisitIssues, type StoreIssue } from '@/features/issues/api'
import { IssueSheet } from './IssueSheet'
import styles from './IssuesSection.module.scss'

interface IssuesSectionProps {
  visit: Visit
  catalogs: Catalogs
  me: { id: string; name: string }
}

const stateText = (i: StoreIssue) => (i.status === 'resolved' ? `Resuelta${i.resolvedBy ? ` por ${i.resolvedBy}` : ''}` : i.pending ? 'Se envía con señal' : 'Enviada al supervisor')

/**
 * What the activador found at the store that the supervisor should know: it needs an
 * order, no stock, no price... Optional, at any moment of the visit, also without signal.
 */
export function IssuesSection({ visit: v, catalogs, me }: IssuesSectionProps) {
  const issues = useVisitIssues(v.id, me)
  const [open, setOpen] = useState(false)
  const { confirm, dialog } = useConfirm()
  const changes = visitChanges(v)
  const types = (catalogs.issueTypes ?? []).filter((t) => t.active)
  const typeName = (id: number) => (catalogs.issueTypes ?? []).find((t) => t.id === id)?.name ?? 'Novedad'
  const list = issues.data ?? []
  if (!types.length && !list.length) return null

  const remove = async (i: StoreIssue) => {
    const ok = await confirm({ title: '¿Quitar esta novedad?', description: 'El supervisor deja de verla.', confirmLabel: 'Quitar', tone: 'danger' })
    if (ok) await changes.removeIssue(i.id)
  }

  return (
    <section className={styles.card} aria-label="Novedades del local">
      <div className={styles.head}>
        <Megaphone size={20} aria-hidden />
        <span className={styles.titles}>
          <span className={styles.title}>Novedades del local</span>
          <span className={styles.sub}>Un pedido, falta de stock, precios… lo que el supervisor tiene que saber.</span>
        </span>
      </div>
      {list.length ? (
        <ul className={styles.list}>
          {list.map((i) => (
            <li key={i.id} className={styles.item}>
              <span className={styles.text}>
                <span className={styles.name}>{typeName(i.typeId)}</span>
                {i.note ? <span className={styles.note}>{i.note}</span> : null}
                <span className={styles.meta} data-state={i.status === 'resolved' ? 'resolved' : i.pending ? 'pending' : 'sent'}>
                  {formatTime(i.createdAt)} · {stateText(i)}{i.resolution ? `: ${i.resolution}` : ''}
                </span>
              </span>
              {i.status === 'open' && i.createdBy === me.id ? (
                <button type="button" className={styles.remove} onClick={() => void remove(i)} aria-label={`Quitar novedad: ${typeName(i.typeId)}`}>
                  <Trash2 size={18} aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {types.length ? <Button variant="secondary" onClick={() => setOpen(true)}><Plus size={20} aria-hidden />Reportar novedad</Button> : null}
      <IssueSheet open={open} place={v.store.name ?? v.store.address} types={types} onClose={() => setOpen(false)} onSend={(typeId, note) => changes.reportIssue(typeId, note)} />
      {dialog}
    </section>
  )
}
