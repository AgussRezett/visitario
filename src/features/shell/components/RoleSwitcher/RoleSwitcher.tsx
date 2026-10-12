import { ROLE_LABEL, viewGroups, type ActiveMembership, type ViewOption } from '@/domain/roles'
import { useSwitchView } from '@/features/shell/components/ViewSwitcher/useSwitchView'
import styles from './RoleSwitcher.module.scss'

/** Desktop sidebar: lets a person with several companies or roles pick which view to open. */
export function RoleSwitcher({ memberships, active }: { memberships: ActiveMembership[]; active: ViewOption }) {
  const switchView = useSwitchView()
  const groups = viewGroups(memberships)
  const options = groups.flatMap((g) => g.roles.map((role) => ({ value: `${g.companyId}|${role}`, label: `${g.label} · ${ROLE_LABEL[role]}` })))
  if (options.length < 2) return <p className={styles.current}>{options[0]?.label}</p>
  return (
    <label className={styles.picker}>
      <span className={styles.srOnly}>Vista</span>
      <select
        className={styles.select}
        value={`${active.companyId}|${active.role}`}
        onChange={(e) => {
          const [companyId, role] = e.target.value.split('|') as [string, ViewOption['role']]
          switchView({ companyId, role })
        }}
      >
        {groups.map((g) => (
          <optgroup key={g.companyId} label={g.label}>
            {g.roles.map((role) => (
              <option key={role} value={`${g.companyId}|${role}`}>{g.label} · {ROLE_LABEL[role]}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}
