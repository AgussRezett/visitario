import { useNavigate } from '@tanstack/react-router'
import { CalendarDays, CalendarX, CheckCheck, CircleCheck, Inbox, LayoutGrid, MessageSquareText, type LucideIcon } from 'lucide-react'
import { formatDayMonth, todayInArgentina } from '@/domain/dates'
import { Button } from '@/ui/Button'
import type { ReviewTab } from '@/features/team/api/queries'
import styles from './ReviewEmpty.module.scss'

interface ReviewEmptyProps {
  tab: ReviewTab
  date: string
  counts: Record<ReviewTab, number> | undefined
  onTab: (tab: ReviewTab) => void
}

/** An empty tab says why it is empty and offers the next useful place, across the whole page. */
export function ReviewEmpty({ tab, date, counts, onTab }: ReviewEmptyProps) {
  const navigate = useNavigate()
  const day = date === todayInArgentina() ? 'hoy' : `el ${formatDayMonth(date)}`
  const copy: Record<ReviewTab, { icon: LucideIcon; title: string; lead: string }> = {
    to_review: { icon: CheckCheck, title: 'Todo revisado', lead: 'No hay visitas terminadas esperando. Cuando un activador termine una, aparece acá.' },
    needs_fix: { icon: MessageSquareText, title: 'Ninguna corrección pendiente', lead: 'Cuando pidas una corrección, la visita espera acá hasta que el activador la reenvíe.' },
    approved: { icon: CircleCheck, title: `Nada aprobado ${day}`, lead: 'Elegí otro día arriba, o fijate si hay visitas esperando revisión.' },
    all: { icon: CalendarX, title: `Sin visitas ${day}`, lead: 'Ese día nadie tenía locales asignados. Elegí otro día arriba.' },
  }
  const { icon: Icon, title, lead } = copy[tab]

  // The tab with work waiting, if there is one.
  const waiting = tab !== 'to_review' && counts?.to_review
    ? { tab: 'to_review' as const, label: `Ver por revisar · ${counts.to_review}`, icon: Inbox }
    : tab !== 'needs_fix' && counts?.needs_fix
      ? { tab: 'needs_fix' as const, label: `Ver correcciones · ${counts.needs_fix}`, icon: MessageSquareText }
      : null
  const elsewhere = tab === 'all'
    ? { to: '/s/$section' as const, section: 'assign', label: 'Asignar jornadas', icon: CalendarDays }
    : { to: '/s/$section' as const, section: 'today', label: 'Ver hoy en el equipo', icon: LayoutGrid }
  const ElsewhereIcon = elsewhere.icon

  return (
    <section className={styles.empty} aria-labelledby="review-empty-title">
      <span className={styles.icon} aria-hidden><Icon size={26} /></span>
      <h2 id="review-empty-title" className={styles.title}>{title}</h2>
      <p className={styles.lead}>{lead}</p>
      <div className={styles.actions}>
        {waiting ? (
          <Button className={styles.primary} onClick={() => onTab(waiting.tab)}>
            <waiting.icon size={20} aria-hidden />
            {waiting.label}
          </Button>
        ) : null}
        <Button variant={waiting ? 'ghost' : 'secondary'} size="md" onClick={() => navigate({ to: elsewhere.to, params: { section: elsewhere.section } })}>
          <ElsewhereIcon size={18} aria-hidden />
          {elsewhere.label}
        </Button>
      </div>
    </section>
  )
}
