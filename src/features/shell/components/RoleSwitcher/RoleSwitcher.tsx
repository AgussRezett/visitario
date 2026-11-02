import { ROLE_LABEL, viewGroups, type ActiveMembership, type ViewOption } from '@/domain/roles'
import { useSwitchView } from '@/features/shell/components/ViewSwitcher/useSwitchView'
import { Select } from '@/ui/Select'
import styles from './RoleSwitcher.module.scss'

/** Desktop sidebar: lets a person with several companies or roles pick which view to open. */
export function RoleSwitcher({ memberships, active }: { memberships: ActiveMembership[]; active: ViewOption }) {
  const switchView = useSwitchView()
  const groups = viewGroups(memberships)
  // Grouped by company in the list; the button says both.
  const options = groups.flatMap((g) => g.roles.map((role) => ({
    value: `${g.companyId}|${role}`,
    label: ROLE_LABEL[role],
    selectedLabel: `${g.label} · ${ROLE_LABEL[role]}`,
    group: groups.length > 1 ? g.label : undefined,
  })))
  if (options.length < 2) return <p className={styles.current}>{options[0]?.selectedLabel}</p>
  return (
    <div className={styles.picker}>
      <Select
        label="Vista"
        hideLabel
        size="sm"
        value={`${active.companyId}|${active.role}`}
        options={options}
        searchable={false}
        onChange={(v) => {
          const [companyId, role] = v.split('|') as [string, ViewOption['role']]
          switchView({ companyId, role })
        }}
        className={styles.select}
      />
    </div>
  )
}
