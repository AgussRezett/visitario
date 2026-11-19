import { useQuery } from '@tanstack/react-query'
import { RotateCcw } from 'lucide-react'
import { formatDayMonth, todayInArgentina } from '@/domain/dates'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { closedCompaniesQuery, useReopenCompany } from '@/features/admin/api/closure'
import styles from './ClosedCompanies.module.scss'

const day = (iso: string) => formatDayMonth(todayInArgentina(new Date(iso)), true)

/** Companies I closed (or was an admin of) that I can still reopen. Nothing when there are none. */
export function ClosedCompanies() {
  const closed = useQuery(closedCompaniesQuery)
  const reopen = useReopenCompany()
  if (!closed.data?.length) return null
  return (
    <section className={styles.closed} aria-label="Empresas cerradas">
      <h2 className={styles.heading}>Empresas cerradas</h2>
      <ul className={styles.list}>
        {closed.data.map((c) => (
          <li key={c.companyId} className={styles.row}>
            <span className={styles.text}>
              <span className={styles.name}>{c.name}</span>
              <span className={styles.when}>La cerró {c.closedBy} el {day(c.closedAt)}. Se puede reabrir hasta el {day(c.reopenUntil)}.</span>
            </span>
            <Button variant="secondary" size="md" loading={reopen.isPending && reopen.variables === c.companyId} disabled={reopen.isPending}
              onClick={() => reopen.mutate(c.companyId)}>
              <RotateCcw size={18} aria-hidden />Reabrir
            </Button>
          </li>
        ))}
      </ul>
      {reopen.error ? <Banner tone="error">{reopen.error.message}</Banner> : null}
    </section>
  )
}
