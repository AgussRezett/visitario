import { useState, type ReactNode } from 'react'
import { Link, useMatches } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Building2, UserRound } from 'lucide-react'
import clsx from 'clsx'
import { Logo } from '@/ui/Logo'
import { Avatar } from '@/ui/Avatar'
import { avatarUrl } from '@/lib/avatars'
import { initials } from '@/lib/format'
import type { Me } from '@/features/auth/me'
import type { Role } from '@/domain/roles'
import { SECTIONS } from '@/features/shell/sections'
import { RoleSwitcher } from '@/features/shell/components/RoleSwitcher'
import { ViewSwitcher } from '@/features/shell/components/ViewSwitcher'
import { UpdateBanner } from '@/features/shell/components/UpdateBanner'
import { InstallOffer } from '@/features/install/components/InstallOffer'
import { useLive } from '@/features/live/live'
import { OperationLive } from '@/features/operation/OperationLive'
import { SyncStatus } from '@/features/sync/components/SyncStatus'
import { useNavBadges } from '@/features/shell/useNavBadges'
import { MainOverlayContext } from './main-overlay-context'
import styles from './AppShell.module.scss'

interface Props {
  me: Me & { person: NonNullable<Me['person']> }
  active: { companyId: string; role: Role } | null
  children: ReactNode
}

const activeProps = { className: styles.active }

/**
 * Responsive frame on a grid: header, content and bottom navigation on phones; sidebar and
 * content on desktop. Only the content (and the sidebar) scroll; the bars never move.
 */
export function AppShell({ me, active, children }: Props) {
  const [overlay, setOverlay] = useState<HTMLElement | null>(null)
  const badges = useNavBadges(me.person.id, active)
  const photo = avatarUrl(me.person.avatarPath)
  useLive(useQueryClient(), active?.companyId ?? null, me.person?.id ?? null)
  const badge = (slug: string) => (badges[slug] ? <span className={styles.badge} aria-label={`${badges[slug]} pendientes`}>{badges[slug]}</span> : null)
  const sections = active ? SECTIONS[active.role] : []
  const name = `${me.person.firstName} ${me.person.lastName}`
  const short = initials(me.person.firstName, me.person.lastName)
  const mobileItems = active?.role === 'merchandiser' ? [...sections, null] : sections
  const immersive = useMatches({ select: (matches) => matches.some((m) => m.staticData.immersive) })

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} data-scroll>
        <Link to="/" aria-label="Inicio" className={styles.sidebarLogo}><Logo /></Link>
        {active ? <RoleSwitcher memberships={me.memberships} active={active} /> : null}
        <SyncStatus variant="full" className={styles.sidebarSync} />
        <nav aria-label="Secciones" className={styles.sidebarNav}>
          {sections.map((s) => (
            <Link key={s.slug} to="/s/$section" params={{ section: s.slug }} className={styles.navLink} activeProps={activeProps}>
              <s.icon size={20} aria-hidden />
              <span className={styles.navText}>{s.title}</span>
              {badge(s.slug)}
            </Link>
          ))}
        </nav>
        {me.isPlatformAdmin ? (
          <>
            <p className={styles.accountTitle}>Plataforma</p>
            <Link to="/platform" className={styles.navLink} activeProps={activeProps}>
              <Building2 size={20} aria-hidden />
              <span className={styles.navText}>Empresas</span>
            </Link>
          </>
        ) : null}
        <p className={styles.accountTitle}>Cuenta</p>
        <Link to="/profile" className={styles.navLink} activeProps={activeProps}>
          <Avatar name={short} src={photo} size={24} />
          <span className={styles.accountName}>{name}</span>
        </Link>
      </aside>

      <header className={clsx(styles.mobileHeader, immersive && styles.phoneHidden)}>
        <Link to="/" aria-label="Inicio"><Logo /></Link>
        <div className={styles.headerEnd}>
          <SyncStatus />
          {active ? <ViewSwitcher memberships={me.memberships} active={active} /> : null}
          {active?.role === 'merchandiser' ? null : (
            <Link to="/profile" aria-label="Mi perfil">
              <Avatar name={short} src={photo} size={36} />
            </Link>
          )}
        </div>
      </header>

      <UpdateBanner />
      <InstallOffer />
      {active?.role === 'merchandiser' ? <OperationLive companyId={active.companyId} personId={me.person.id} firstName={me.person.firstName} /> : null}

      <main className={clsx(styles.main, immersive && styles.mainImmersive)} data-scroll>
        <MainOverlayContext.Provider value={overlay}>{children}</MainOverlayContext.Provider>
      </main>
      {/* Same grid cell as <main>, on top: floating actions without fixed positioning */}
      <div ref={setOverlay} className={clsx(styles.overlay, immersive && styles.phoneHidden)} />

      {mobileItems.length > 1 ? (
        <nav aria-label="Secciones" className={clsx(styles.bottomNav, immersive && styles.phoneHidden)} style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}>
          {mobileItems.map((s) =>
            s ? (
              <Link key={s.slug} to="/s/$section" params={{ section: s.slug }} className={styles.tab} activeProps={activeProps}>
                <span className={styles.tabIcon}>
                  <s.icon size={22} aria-hidden />
                  {badge(s.slug)}
                </span>
                {s.label}
              </Link>
            ) : (
              <Link key="profile" to="/profile" className={styles.tab} activeProps={activeProps}>
                {photo ? <Avatar name={short} src={photo} size={24} className={styles.tabAvatar} /> : <UserRound size={22} aria-hidden />}
                Perfil
              </Link>
            ),
          )}
        </nav>
      ) : null}
    </div>
  )
}
