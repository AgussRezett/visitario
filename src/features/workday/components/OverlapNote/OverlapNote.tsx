import { Users } from 'lucide-react'
import clsx from 'clsx'
import { overlapText, type Overlap } from '@/domain/overlaps'
import styles from './OverlapNote.module.scss'

/** "Lucía G. ya lo tiene en su jornada de hoy…": a heads-up before adding the same store twice. */
export function OverlapNote({ list, when, id, className }: { list: Overlap[] | undefined; when: string; id?: string; className?: string }) {
  const text = overlapText(list ?? [], when)
  if (!text) return null
  return (
    <span id={id} className={clsx(styles.note, className)}>
      <Users size={14} aria-hidden className={styles.icon} />
      {text}
    </span>
  )
}
