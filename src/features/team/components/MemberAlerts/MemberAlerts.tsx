import type { MemberAlert } from '@/domain/team'
import { Chip, type ChipTone } from '@/ui/StatusChip'

const TONE: Record<MemberAlert['kind'], ChipTone> = { inactive: 'closed', unsynced: 'inProgress', failed: 'refused', fix: 'needsFix', refused: 'refused' }

/** The alerts of a merchandiser as chips, or a quiet "Sin alertas". */
export function MemberAlerts({ alerts, empty = 'Sin alertas', max = 2, className }: { alerts: MemberAlert[]; empty?: string; max?: number; className?: string }) {
  if (!alerts.length) return <span className={className}>{empty}</span>
  return (
    <span className={className}>
      {alerts.slice(0, max).map((a) => (
        <Chip key={a.kind} tone={TONE[a.kind]}>{a.text}</Chip>
      ))}
    </span>
  )
}
