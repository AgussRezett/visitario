import { useState, type ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Building2, ChevronRight, Ellipsis } from 'lucide-react'
import clsx from 'clsx'
import { Sheet } from '@/ui/Sheet'
import type { Section } from '@/features/shell/sections'
import styles from './MoreMenu.module.scss'

interface MoreMenuProps {
  sections: Section[]
  badges: Record<string, number | undefined>
  /** Platform admins: the companies, which only the sidebar had. */
  platform: boolean
  /** The bottom bar's tab classes, so "Más" looks like its neighbours. */
  tabClassName?: string
  activeClassName?: string
  iconClassName?: string
  badge: (slug: string) => ReactNode
}

/**
 * The fifth tab on phones when a role has more than five sections: the rest, one tap away,
 * in a sheet with what each one is for. Lit when the open page is one of them; its dot
 * adds up what waits inside.
 */
export function MoreMenu({ sections, badges, platform, tabClassName, activeClassName, iconClassName, badge }: MoreMenuProps) {
  const [open, setOpen] = useState(false)
  const path = useRouterState({ select: (r) => r.location.pathname })
  const here = sections.some((s) => path.startsWith(`/s/${s.slug}`)) || (platform && path.startsWith('/platform'))
  const waiting = sections.reduce((n, s) => n + (badges[s.slug] ?? 0), 0)

  return (
    <>
      <button type="button" className={clsx(tabClassName, here && activeClassName)} data-current={here || undefined} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <span className={iconClassName}>
          <Ellipsis size={22} aria-hidden />
          {waiting ? <span className={styles.dot} aria-label={`${waiting} pendientes`}>{waiting}</span> : null}
        </span>
        Más
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Más secciones">
        <nav aria-label="Más secciones" className={styles.list}>
          {sections.map((s) => (
            <Link key={s.slug} to="/s/$section" params={{ section: s.slug }} className={styles.item} activeProps={{ className: styles.current }} onClick={() => setOpen(false)}>
              <span className={styles.icon}><s.icon size={20} aria-hidden /></span>
              <span className={styles.text}>
                <span className={styles.title}>{s.title}</span>
                <span className={styles.summary}>{s.summary}</span>
              </span>
              {badge(s.slug)}
              <ChevronRight size={18} aria-hidden className={styles.chevron} />
            </Link>
          ))}
          {platform ? (
            <Link to="/platform" className={styles.item} activeProps={{ className: styles.current }} onClick={() => setOpen(false)}>
              <span className={styles.icon}><Building2 size={20} aria-hidden /></span>
              <span className={styles.text}>
                <span className={styles.title}>Empresas</span>
                <span className={styles.summary}>Las empresas de Visitario, sus planes y el soporte.</span>
              </span>
              <ChevronRight size={18} aria-hidden className={styles.chevron} />
            </Link>
          ) : null}
        </nav>
      </Sheet>
    </>
  )
}
