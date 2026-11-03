import type { PersonRow } from '@/domain/analytics'
import { PersonAvatar } from '@/features/people/PersonAvatar'
import { minutesText, num, pct } from '../format'
import styles from './PeopleRanking.module.scss'

interface Props {
  rows: PersonRow[]
  names: Map<string, { first: string; last: string }>
  /** The first work metric of the company ("Punteras activadas"), if any. */
  metric?: { id: number; name: string }
  onPick?: (personId: string) => void
}

/** Who did what in the period: visits with a result as a bar, and the rates that matter. */
export function PeopleRanking({ rows, names, metric, onPick }: Props) {
  const max = Math.max(1, ...rows.map((r) => r.planned))
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>Activadores en el período</caption>
        <thead>
          <tr>
            <th scope="col">Activador</th>
            <th scope="col">Con resultado</th>
            <th scope="col" className={styles.num}>Cumplimiento</th>
            <th scope="col" className={styles.num}>Activadas</th>
            <th scope="col" className={styles.num}>No aut.</th>
            <th scope="col" className={styles.num}>Por día</th>
            <th scope="col" className={styles.num}>En el local</th>
            <th scope="col" className={styles.num}>Exhib. acomodadas</th>
            {metric ? <th scope="col" className={styles.num}>{metric.name}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const n = names.get(r.personId)
            return (
              <tr key={r.personId}>
                <th scope="row">
                  <button type="button" className={styles.person} onClick={() => onPick?.(r.personId)} title="Ver solo a esta persona">
                    <PersonAvatar personId={r.personId} firstName={n?.first ?? '?'} lastName={n?.last ?? ''} size={28} />
                    <span className={styles.name}>{n ? `${n.first} ${n.last}` : 'Sin nombre'}</span>
                  </button>
                </th>
                <td>
                  <span className={styles.bar} aria-label={`${r.visited} de ${r.planned}`}>
                    <span className={styles.track}>
                      <span className={styles.fillDone} style={{ width: `${(r.done / max) * 100}%` }} />
                      <span className={styles.fillOther} style={{ width: `${((r.visited - r.done) / max) * 100}%` }} />
                    </span>
                    <span className={styles.barText}>{num(r.visited)}<span className={styles.of}>/{num(r.planned)}</span></span>
                  </span>
                </td>
                <td className={styles.num}>{pct(r.completion)}</td>
                <td className={styles.num}>{num(r.done)}</td>
                <td className={styles.num} data-alert={r.refused > 0 || undefined}>{num(r.refused)}</td>
                <td className={styles.num}>{r.perDay === null ? '—' : num(r.perDay, 1)}</td>
                <td className={styles.num}>{minutesText(r.minutes)}</td>
                <td className={styles.num}>{num(r.arranged)}</td>
                {metric ? <td className={styles.num}>{num(r.metrics[metric.id] ?? 0)}</td> : null}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
