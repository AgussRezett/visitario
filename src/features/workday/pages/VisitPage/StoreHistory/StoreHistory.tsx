import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronRight, History } from 'lucide-react'
import { formatDayMonth } from '@/domain/dates'
import { StatusChip } from '@/ui/StatusChip'
import { storeHistoryQuery, type PastVisit } from '@/features/workday/api/history'
import styles from './StoreHistory.module.scss'

const thisYear = new Date().getFullYear()
const when = (date: string) => formatDayMonth(date, Number(date.slice(0, 4)) !== thisYear)
const summary = (p: PastVisit) =>
  p.displays ? `${p.displays} ${p.displays === 1 ? 'exhibición' : 'exhibiciones'} · ${p.afters} ${p.afters === 1 ? 'foto del después' : 'fotos del después'}` : 'Sin exhibiciones'

/**
 * The store's past visits, by anyone in the company: what was done there before, to open
 * each one. Folded until asked, so the visit stays about today's work.
 */
export function StoreHistory({ visitId }: { visitId: string }) {
  const [open, setOpen] = useState(false)
  const history = useQuery({ ...storeHistoryQuery(visitId), enabled: open })
  const from = `/visit/${visitId}`

  return (
    <section className={styles.card} aria-label="Historial del local">
      <button type="button" className={styles.toggle} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <History size={20} aria-hidden />
        <span className={styles.title}>Historial del local</span>
        <ChevronDown size={20} aria-hidden className={styles.chevron} />
      </button>
      {open ? (
        history.isPending ? <p className={styles.help}>Buscando visitas anteriores…</p>
          : history.isError ? <p className={styles.help}>No pudimos cargar el historial. Revisá la conexión.</p>
            : !history.data?.length ? <p className={styles.help}>Todavía no hay visitas anteriores a este local.</p>
              : (
                <ul className={styles.list}>
                  {history.data.map((p) => (
                    <li key={p.id}>
                      <Link to="/past/$visitId" params={{ visitId: p.id }} search={{ from }} className={styles.row}>
                        <span className={styles.text}>
                          <span className={styles.name}>{when(p.workDate)} · {p.merchandiser}</span>
                          <span className={styles.note}>{summary(p)}</span>
                        </span>
                        <StatusChip work={p.workStatus} review={p.reviewStatus} />
                        <ChevronRight size={18} aria-hidden className={styles.go} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )
      ) : null}
    </section>
  )
}
