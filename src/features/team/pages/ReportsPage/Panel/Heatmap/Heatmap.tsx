import { num } from '../format'
import styles from './Heatmap.module.scss'

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/** When the team reaches the stores: arrivals by weekday and hour; darker, more arrivals. */
export function Heatmap({ grid }: { grid: number[][] }) {
  const hours = grid.flatMap((row) => row.map((n, h) => (n ? h : null))).filter((h): h is number => h !== null)
  if (!hours.length) return <p className={styles.empty}>Sin llegadas marcadas en el período.</p>
  const from = Math.max(0, Math.min(...hours, 8))
  const to = Math.min(23, Math.max(...hours, 18))
  const cols = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  const rows = grid.map((row, d) => ({ d, row })).filter(({ d, row }) => d < 6 || row.some(Boolean))
  const max = Math.max(1, ...grid.flat())
  let peak = { d: 0, h: 0, n: 0 }
  grid.forEach((row, d) => row.forEach((n, h) => { if (n > peak.n) peak = { d, h, n } }))

  return (
    <div className={styles.box}>
      <p className={styles.peak}>Más llegadas: <b>{DAYS[peak.d]?.toLowerCase()} de {peak.h} a {peak.h + 1} h</b> ({num(peak.n)})</p>
      <div className={styles.scroll}>
        <table className={styles.grid}>
          <caption className={styles.srOnly}>Llegadas por día de la semana y hora</caption>
          <thead>
            <tr><th aria-hidden />{cols.map((h) => <th key={h} scope="col">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map(({ d, row }) => (
              <tr key={d}>
                <th scope="row">{DAYS[d]?.slice(0, 3)}</th>
                {cols.map((h) => {
                  const n = row[h] ?? 0
                  return (
                    <td key={h} title={`${DAYS[d]} ${h} h: ${n} llegadas`} aria-label={`${DAYS[d]} ${h} h: ${n}`}>
                      <span className={styles.cell} style={{ ['--level' as string]: n ? 0.15 + (n / max) * 0.85 : 0 }} />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.scale} aria-hidden>
        Menos <span className={styles.cell} style={{ ['--level' as string]: 0.15 }} /><span className={styles.cell} style={{ ['--level' as string]: 0.55 }} /><span className={styles.cell} style={{ ['--level' as string]: 1 }} /> Más
      </p>
    </div>
  )
}
