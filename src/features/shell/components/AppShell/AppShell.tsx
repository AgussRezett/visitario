import type { ReactNode } from 'react'
import { Link, useMatches } from '@tanstack/react-router'
import { UserRound } from 'lucide-react'
import clsx from 'clsx'
import { Logo } from '@/ui/Logo'
import { Avatar } from '@/ui/Avatar'
import { initials } from '@/lib/format'
import type { Me } from '@/features/auth/me'
import type { Role } from '@/domain/roles'
import { SECTIONS } from '@/features/shell/sections'
import { RoleSwitcher } from '@/features/shell/components/RoleSwitcher'
import styles from './AppShell.module.scss'

interface Props {
  me: Me & { person: NonNullable<Me['person']> }
  active: { companyId: string; role: Role } | null
  children: ReactNode
}

const activeProps = { className: styles.active }

/** Responsive frame: bottom navigation on phones, sidebar on desktop. Same routes on both. */
export function AppShell({ me, active, children }: Props) {
  const sections = active ? SECTIONS[active.role] : []
  const name = `${me.person.firstName} ${me.person.lastName}`
  const short = initials(me.person.firstName, me.person.lastName)
  const mobileItems = active?.role === 'merchandiser' ? [...sections, null] : sections
  const immersive = useMatches({ select: (matches) => matches.some((m) => m.staticData.immersive) })

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link to="/" aria-label="Inicio" className={styles.sidebarLogo}><Logo /></Link>
        {active ? <RoleSwitcher memberships={me.memberships} active={active} /> : null}
        <nav aria-label="Secciones" className={styles.sidebarNav}>
          {sections.map((s) => (
            <Link key={s.slug} to="/s/$section" params={{ section: s.slug }} className={styles.navLink} activeProps={activeProps}>
              <s.icon size={20} aria-hidden />
              {s.title}
            </Link>
          ))}
        </nav>
        <p className={styles.accountTitle}>Cuenta</p>
        <Link to="/profile" className={styles.navLink} activeProps={activeProps}>
          <Avatar name={short} size={24} />
          <span className={styles.accountName}>{name}</span>
        </Link>
      </aside>

      <div className={styles.content}>
        <header className={clsx(styles.mobileHeader, immersive && styles.phoneHidden)}>
          <Link to="/" aria-label="Inicio"><Logo /></Link>
          {active?.role === 'merchandiser' ? null : (
            <Link to="/profile" aria-label="Mi perfil">
              <Avatar name={short} size={36} />
            </Link>
          )}
        </header>
        <main className={clsx(styles.main, immersive && styles.mainImmersive)}>{children}</main>
        {mobileItems.length ? (
          <nav aria-label="Secciones" className={clsx(styles.bottomNav, immersive && styles.phoneHidden)} style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}>
            {mobileItems.map((s) =>
              s ? (
                <Link key={s.slug} to="/s/$section" params={{ section: s.slug }} className={styles.tab} activeProps={activeProps}>
                  <s.icon size={22} aria-hidden />
                  {s.label}
                </Link>
              ) : (
                <Link key="profile" to="/profile" className={styles.tab} activeProps={activeProps}>
                  <UserRound size={22} aria-hidden />
                  Perfil
                </Link>
              ),
            )}
          </nav>
        ) : null}
      </div>
    </div>
  )
}
