import clsx from 'clsx'
import { reviewSummary, type MemberDay, type teamTotals } from '@/domain/team-report'
import { PersonAvatar } from '@/features/people/PersonAvatar'
import { Table } from '@/ui/Table'
import { CHIP } from './chip'
import styles from './ReportsPage.module.scss'

interface ReportsTableProps {
  rows: MemberDay[]
  totals: ReturnType<typeof teamTotals>
  metrics: { id: number; name: string }[]
  selectedId: string | undefined
  onSelect: (personId: string) => void
  lastName: (personId: string) => string
}

/** One row per merchandiser and the team's totals (wireframe S08). Desktop only. */
export function ReportsTable({ rows, totals, metrics, selectedId, onSelect, lastName }: ReportsTableProps) {
  return (
    <Table className={styles.table} label="Informe del equipo por activador">
      <thead>
        <tr>
          <th>Activador</th><th>Visitados</th><th>No visitados</th><th>Extras</th><th>No autoriz.</th>
          {metrics.map((m) => <th key={m.id}>{m.name}</th>)}
          <th>Revisión</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const review = reviewSummary(r)
          return (
            <tr key={r.personId} className={clsx(r.personId === selectedId && styles.rowOn)}>
              <td>
                <button type="button" className={styles.rowButton} onClick={() => onSelect(r.personId)} aria-pressed={r.personId === selectedId}>
                  <PersonAvatar personId={r.personId} firstName={r.name} lastName={lastName(r.personId)} size={28} />{r.name}
                </button>
              </td>
              <td className={styles.num}>{r.visited} / {r.total}</td>
              <td className={styles.num}>{r.notVisited}</td>
              <td className={styles.num}>{r.extras}</td>
              <td className={styles.num}>{r.refused}</td>
              {metrics.map((m) => <td key={m.id} className={styles.num}>{r.metrics[m.id] ?? 0}</td>)}
              <td><span className={clsx(styles.chip, CHIP[review.tone])}>{review.label}</span></td>
            </tr>
          )
        })}
        <tr className={styles.totalRow}>
          <td>Equipo</td>
          <td className={styles.num}>{totals.visited} / {totals.total}</td>
          <td className={styles.num}>{totals.notVisited}</td>
          <td className={styles.num}>{totals.extras}</td>
          <td className={styles.num}>{totals.refused}</td>
          {metrics.map((m) => <td key={m.id} className={styles.num}>{totals.metrics[m.id] ?? 0}</td>)}
          <td />
        </tr>
      </tbody>
    </Table>
  )
}
