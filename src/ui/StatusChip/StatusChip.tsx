import { Check } from 'lucide-react'
import clsx from 'clsx'
import type { ReviewStatus, WorkStatus } from '@/domain/visit'
import { WORK_STATUS_LABEL } from '@/domain/visit'
import styles from './StatusChip.module.scss'

export type ChipTone = 'pending' | 'inProgress' | 'done' | 'closed' | 'refused' | 'needsFix' | 'approved'

const TONE: Record<WorkStatus, ChipTone> = {
  pending: 'pending',
  in_progress: 'inProgress',
  done: 'done',
  closed: 'closed',
  refused: 'refused',
}

/** A soft chip with a dot (or an icon in its place); approved shows a tick. */
export function Chip({ tone, icon, children, className }: { tone: ChipTone; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const lead = icon ?? (tone === 'approved' ? <Check size={14} strokeWidth={3} aria-hidden /> : <span className={styles.dot} aria-hidden />)
  return (
    <span className={clsx(styles.chip, styles[tone], className)}>
      {lead}
      {children}
    </span>
  )
}

/** Visit status: review wins when it says approved or needs a fix. */
export function StatusChip({ work, review = 'unreviewed', label }: { work: WorkStatus; review?: ReviewStatus; label?: string }) {
  if (review === 'approved') return <Chip tone="approved">Aprobada</Chip>
  if (review === 'needs_fix') return <Chip tone="needsFix">Con corrección</Chip>
  return <Chip tone={TONE[work]}>{label ?? WORK_STATUS_LABEL[work]}</Chip>
}
