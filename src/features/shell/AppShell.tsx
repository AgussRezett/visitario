import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { UserRound } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Logo } from '@/ui/Logo'
import { Avatar } from '@/ui/Avatar'
import { initials } from '@/lib/format'
import type { Me } from '@/features/auth/me'
import type { Role } from '@/domain/roles'
import { SECTIONS } from './sections'
import { RoleSwitcher } from './RoleSwitcher'

interface Props {
  me: Me & { person: NonNullable<Me['person']> }
  active: { companyId: string; role: Role } | null
  children: ReactNode
}

const navLink = 'flex h-11 items-center gap-2.5 rounded-md px-3 text-sm font-bold text-ink-muted no-underline'
const navActive = 'bg-lime-soft text-forest font-extrabold dark:bg-muted dark:text-lime'

/** Responsive frame: bottom navigation on phones, sidebar on desktop. Same routes on both. */
export function AppShell({ me, active, children }: Props) {
  const sections = active ? SECTIONS[active.role] : []
  const name = `${me.person.firstName} ${me.person.lastName}`
  const short = initials(me.person.firstName, me.person.lastName)
  const mobileItems = active?.role === 'merchandiser' ? [...sections, null] : sections

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-line bg-card px-3 py-5 lg:flex">
        <div className="px-2 pb-4"><Logo /></div>
        {active ? <RoleSwitcher memberships={me.memberships} active={active} /> : null}
        <nav aria-label="Secciones" className="mt-3 flex flex-col gap-1">
          {sections.map((s) => (
            <Link key={s.slug} to="/s/$section" params={{ section: s.slug }} className={navLink} activeProps={{ className: navActive }}>
              <s.icon size={20} aria-hidden />
              {s.title}
            </Link>
          ))}
        </nav>
        <p className="eyebrow px-2.5 pb-1.5 pt-4">Cuenta</p>
        <Link to="/profile" className={navLink} activeProps={{ className: navActive }}>
          <Avatar name={short} size={24} />
          <span className="truncate">{name}</span>
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-5 pb-1 pt-4 lg:hidden">
          <Logo />
          {active?.role === 'merchandiser' ? null : (
            <Link to="/profile" aria-label="Mi perfil" className="no-underline">
              <Avatar name={short} size={36} />
            </Link>
          )}
        </header>
        <main className="flex flex-1 flex-col pb-24 lg:pb-10">{children}</main>
        {mobileItems.length ? (
          <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 grid border-t border-line bg-card px-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-1.5 lg:hidden" style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}>
            {mobileItems.map((s) =>
              s ? (
                <Link key={s.slug} to="/s/$section" params={{ section: s.slug }} className={cn('flex h-14 flex-col items-center justify-center gap-1 rounded-md text-xs font-semibold text-ink-subtle no-underline')} activeProps={{ className: navActive }}>
                  <s.icon size={22} aria-hidden />
                  {s.label}
                </Link>
              ) : (
                <Link key="profile" to="/profile" className="flex h-14 flex-col items-center justify-center gap-1 rounded-md text-xs font-semibold text-ink-subtle no-underline" activeProps={{ className: navActive }}>
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
