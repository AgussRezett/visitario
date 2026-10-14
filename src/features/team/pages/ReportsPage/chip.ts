import type { ReviewTone } from '@/domain/team-report'
import styles from './ReportsPage.module.scss'

/** The review chip's colour for each tone. */
export const CHIP: Record<ReviewTone, string | undefined> = {
  approved: styles.chipApproved,
  pending: styles.chipPending,
  fix: styles.chipFix,
  none: styles.chipNone,
}
