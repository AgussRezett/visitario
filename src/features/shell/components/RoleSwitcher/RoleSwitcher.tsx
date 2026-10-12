import { ROLE_LABEL, type ActiveMembership, type Role } from '@/domain/roles'
import { setActiveRole } from '@/features/auth/active-role'
import styles from './RoleSwitcher.module.scss'

/** Lets a person with several companies or roles pick which view to open. */
export function RoleSwitcher({ memberships, active }: { memberships: ActiveMembership[]; active: { companyId: string; role: Role } }) {
  const options = memberships.flatMap((m) => m.roles.map((role) => ({ value: `${m.companyId}|${role}`, label: `${m.companyName} · ${ROLE_LABEL[role]}` })))
  if (options.length < 2) {
    const m = memberships.find((x) => x.companyId === active.companyId)
    return <p className={styles.current}>{m?.companyName} · {ROLE_LABEL[active.role]}</p>
  }
  return (
    <label className={styles.picker}>
      <span className={styles.srOnly}>Vista</span>
      <select
        className={styles.select}
        value={`${active.companyId}|${active.role}`}
        onChange={(e) => {
          const [companyId, role] = e.target.value.split('|') as [string, Role]
          setActiveRole({ companyId, role })
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}
