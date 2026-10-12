import { Link } from '@tanstack/react-router'
import { FileText, History } from 'lucide-react'
import { formatShortWeekday } from '@/domain/dates'
import { Button } from '@/ui/Button'
import type { Catalogs } from '@/features/workday/api/queries'
import styles from './SidePanels.module.scss'

/** Running totals for the daily report, so the day can be checked before copying it. */
export function ReportPanel({ date, visited, catalogs, totals }: { date: string; visited: number; catalogs: Catalogs | undefined; totals: Record<number, number> }) {
  const metrics = catalogs?.metrics ?? []
  return (
    <section className={styles.panel} aria-label="Para el informe">
      <div className={styles.head}>
        <h2 className={styles.title}>Para el informe</h2>
        <Link to="/s/report" search={{ date }} className={styles.link}>
          <FileText size={16} aria-hidden />Ver informe
        </Link>
      </div>
      <dl className={styles.rows}>
        <div className={styles.row}><dt>Clientes visitados</dt><dd>{visited}</dd></div>
        {metrics.map((m) => (
          <div key={m.id} className={styles.row}><dt>{m.name}</dt><dd>{totals[m.id] ?? 0}</dd></div>
        ))}
      </dl>
      {!metrics.length ? <p className={styles.help}>Tu empresa todavía no cargó números de trabajo.</p> : null}
    </section>
  )
}

interface PendingItem {
  visit_id: string
  work_date: string
  store_name: string | null
  address: string
  work_status: string
}

/** Pending or closed stores from earlier days, ready to add to this one. */
export function ResumePanel({ items, onResume }: { items: PendingItem[]; onResume: () => void }) {
  if (!items.length) return null
  return (
    <section className={styles.resume} aria-label="De días anteriores">
      <div className={styles.head}>
        <h2 className={styles.title}>De días anteriores</h2>
        <span className={styles.badge}>{items.length}</span>
      </div>
      <ul className={styles.items}>
        {items.slice(0, 3).map((v) => (
          <li key={v.visit_id}>
            <span className={styles.itemName}>{v.store_name ?? v.address}</span>
            <span className={styles.itemMeta}>{formatShortWeekday(v.work_date)} · {v.work_status === 'closed' ? 'cerrado' : 'pendiente'}</span>
          </li>
        ))}
      </ul>
      {items.length > 3 ? <p className={styles.help}>Y {items.length - 3} más.</p> : null}
      <Button variant="secondary" size="md" onClick={onResume}>
        <History size={18} aria-hidden />Elegir cuáles retomar
      </Button>
    </section>
  )
}
