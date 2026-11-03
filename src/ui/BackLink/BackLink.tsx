import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import clsx from 'clsx'
import styles from './BackLink.module.scss'

type BackLinkProps = { label: string; className?: string } & ({ href: string; onClick?: never } | { onClick: () => void; href?: never })

/**
 * Visitario's one way back, above a page's title: an arrow and where it goes ("← Hoy en el
 * equipo"). Phones in full-screen pages (a visit, a review) use their top bar's arrow instead.
 * With `href` it is a link (it also opens in a new tab); with `onClick`, a step back inside a flow.
 */
export function BackLink({ label, className, href, onClick }: BackLinkProps) {
  const navigate = useNavigate()
  const content = <><ArrowLeft size={18} aria-hidden />{label}</>
  if (onClick) return <button type="button" className={clsx(styles.back, className)} onClick={onClick}>{content}</button>
  return (
    <a
      href={href}
      className={clsx(styles.back, className)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        void navigate({ href })
      }}
    >
      {content}
    </a>
  )
}
