import { useEffect, useState } from 'react'
import { ClipboardPaste, Copy, X } from 'lucide-react'
import { Button } from '@/ui/Button'
import { StatusChip } from '@/ui/StatusChip'
import type { Visit } from '@/features/workday/api/queries'
import type { useAssign } from '@/features/team/api/mutations'
import type { StoreTags } from '@/features/workday/store-tags'
import styles from './AssignPage.module.scss'

interface StopRowProps {
  v: Visit
  n: number
  typeName: (id: number) => string
  /** The store's channel and seller names. */
  tags: StoreTags
  assign: ReturnType<typeof useAssign>
  /** The task copied from another row, to paste here. */
  copied: string | null
  onCopy: (task: string) => void
}

/** A stop of the plan: its store, its task (with copy and paste between rows) and removing it. */
export function StopRow({ v, n, typeName, tags, assign, copied, onCopy }: StopRowProps) {
  const [task, setTask] = useState(v.task ?? '')
  useEffect(() => setTask(v.task ?? ''), [v.task])
  const editable = v.workStatus === 'pending'
  const label = v.store.name ?? v.store.address
  const save = (next: string) => next.trim() !== (v.task ?? '') && assign.setTask.mutate({ visitId: v.id, task: next })
  const paste = () => {
    if (copied === null) return
    setTask(copied)
    save(copied)
  }

  return (
    <li className={styles.stop}>
      <span className={styles.num}>{n}</span>
      <span className={styles.stopBody}>
        <span className={styles.stopName}>{label}</span>
        <span className={styles.stopMeta}>
          {[v.store.name ? v.store.address : null, v.store.area, v.store.customerNumber && `Cliente ${v.store.customerNumber}`, tags.channel, tags.seller && `vend. ${tags.seller}`, v.resumedFrom ? 'retomada' : null, v.source === 'added' ? 'agregada por el activador' : null].filter(Boolean).join(' · ')}
        </span>
        {v.displays.length ? (
          <span className={styles.tags}>{v.displays.map((d) => <span key={d.id} className={styles.tag}>{typeName(d.typeId)}</span>)}</span>
        ) : null}
      </span>
      {editable ? (
        <>
          <input
            className={styles.task}
            aria-label={`Tarea en ${label}`}
            placeholder="Tarea"
            value={task}
            maxLength={200}
            onChange={(e) => setTask(e.target.value)}
            onBlur={() => save(task)}
          />
          <span className={styles.stopActions}>
            <Button variant="ghost" size="md" disabled={!task.trim()} onClick={() => onCopy(task.trim())} aria-label={`Copiar la tarea de ${label}`}>
              <Copy size={16} aria-hidden />Copiar
            </Button>
            <Button variant="ghost" size="md" disabled={copied === null || copied === task.trim()} onClick={paste}
              aria-label={`Pegar la tarea en ${label}`} title={copied ? `Pegar "${copied}"` : undefined}>
              <ClipboardPaste size={16} aria-hidden />Pegar
            </Button>
            <Button variant="ghost" size="md" className={styles.remove} onClick={() => assign.remove.mutate(v.id)} aria-label={`Quitar ${label}`}>
              <X size={16} aria-hidden />Quitar
            </Button>
          </span>
        </>
      ) : (
        <StatusChip work={v.workStatus} review={v.reviewStatus} />
      )}
    </li>
  )
}
