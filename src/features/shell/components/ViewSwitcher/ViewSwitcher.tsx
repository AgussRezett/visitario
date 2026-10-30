import { useState } from 'react'
import { BadgeDollarSign, Check, ChevronDown, ClipboardCheck, MapPin, Settings } from 'lucide-react'
import { ROLE_LABEL, viewGroups, type ActiveMembership, type Role, type ViewOption } from '@/domain/roles'
import { Sheet } from '@/ui/Sheet'
import { CompanyLogo } from '@/features/shell/components/CompanyLogo'
import { useSwitchView } from './useSwitchView'
import styles from './ViewSwitcher.module.scss'

const ROLE_ICON = { merchandiser: MapPin, seller: BadgeDollarSign, supervisor: ClipboardCheck, admin: Settings } as const
const ROLE_HINT: Record<Role, string> = {
  merchandiser: 'Tu jornada, tus visitas y el informe',
  seller: 'Tus clientes y sus activaciones',
  supervisor: 'El avance del equipo y las revisiones',
  admin: 'Usuarios, catálogos y datos de la empresa',
}

interface ViewSwitcherProps {
  memberships: ActiveMembership[]
  active: ViewOption
}

/** Phone header: which company and role is open, and the sheet to change it. */
export function ViewSwitcher({ memberships, active }: ViewSwitcherProps) {
  const [open, setOpen] = useState(false)
  const switchView = useSwitchView()
  const groups = viewGroups(memberships)
  const current = groups.find((g) => g.companyId === active.companyId)
  const label = `${current?.label ?? ''} · ${ROLE_LABEL[active.role]}`
  const several = groups.reduce((n, g) => n + g.roles.length, 0) > 1

  const logo = memberships.find((m) => m.companyId === active.companyId)?.logoPath
  if (!several) {
    return logo ? (
      <span className={styles.current}><CompanyLogo path={logo} name={current?.label ?? ''} height={22} /><span className={styles.role}>{ROLE_LABEL[active.role]}</span></span>
    ) : <span className={styles.current}>{label}</span>
  }

  return (
    <>
      <button type="button" className={styles.pill} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`Vista: ${label}. Cambiar de vista`}>
        <span className={styles.pillText}>
          {logo ? <CompanyLogo path={logo} name={current?.label ?? ''} height={20} className={styles.pillLogo} /> : <span className={styles.company}>{current?.label}</span>}
          <span className={styles.role}>{ROLE_LABEL[active.role]}</span>
        </span>
        <ChevronDown size={18} aria-hidden />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Cambiar de vista" subtitle="Elegí con qué empresa y rol trabajar en este dispositivo.">
        <div className={styles.groups}>
          {groups.map((g) => (
            <section key={g.companyId} className={styles.group} aria-label={g.label}>
              <h3 className={styles.groupTitle}>
                {g.label}
                {g.personal ? <span className={styles.groupNote}>Tus clientes, sin supervisor</span> : null}
              </h3>
              {g.roles.map((role) => {
                const Icon = ROLE_ICON[role]
                const selected = g.companyId === active.companyId && role === active.role
                return (
                  <button
                    key={role}
                    type="button"
                    className={selected ? styles.optionSelected : styles.option}
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => {
                      setOpen(false)
                      if (!selected) switchView({ companyId: g.companyId, role })
                    }}
                  >
                    <span className={styles.optionIcon}><Icon size={20} aria-hidden /></span>
                    <span className={styles.optionText}>
                      <span className={styles.optionTitle}>{ROLE_LABEL[role]}</span>
                      <span className={styles.optionHint}>{ROLE_HINT[role]}</span>
                    </span>
                    {selected ? <Check size={20} strokeWidth={3} className={styles.check} aria-hidden /> : null}
                  </button>
                )
              })}
            </section>
          ))}
        </div>
      </Sheet>
    </>
  )
}
