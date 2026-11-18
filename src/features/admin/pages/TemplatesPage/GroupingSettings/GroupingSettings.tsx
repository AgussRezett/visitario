import { GROUPINGS, type MessageGrouping } from '@/domain/message-groups'
import { Select } from '@/ui/Select'
import type { CompanySettings } from '@/features/admin/api/company'
import styles from './GroupingSettings.module.scss'

interface GroupingSettingsProps {
  company: CompanySettings | undefined
  disabled: boolean
  onChange: (change: { messagesBefore?: MessageGrouping; messagesAfter?: MessageGrouping }) => void
}

const OPTIONS = GROUPINGS.map((g) => ({ value: g.value, label: g.label }))
const help = (g: MessageGrouping | undefined) => GROUPINGS.find((x) => x.value === g)?.help ?? ''

/** How many ANTES and DESPUÉS messages a visit makes, each on its own. */
export function GroupingSettings({ company, disabled, onChange }: GroupingSettingsProps) {
  return (
    <fieldset className={styles.groups}>
      <legend className={styles.legend}>Cuántos mensajes con fotos</legend>
      <div className={styles.field}>
        <Select label="ANTES" value={company?.messagesBefore ?? 'visit'} options={OPTIONS} disabled={disabled}
          onChange={(v) => onChange({ messagesBefore: v as MessageGrouping })} />
        <p className={styles.help}>{help(company?.messagesBefore)}</p>
      </div>
      <div className={styles.field}>
        <Select label="DESPUÉS" value={company?.messagesAfter ?? 'visit'} options={OPTIONS} disabled={disabled}
          onChange={(v) => onChange({ messagesAfter: v as MessageGrouping })} />
        <p className={styles.help}>{help(company?.messagesAfter)}</p>
      </div>
      <p className={styles.help}>{'{exhibiciones}'} nombra solo las exhibiciones de cada mensaje.</p>
    </fieldset>
  )
}
