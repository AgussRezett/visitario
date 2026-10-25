import type { GroupInsight, insights } from '@/domain/store-map'
import styles from './InsightsPanel.module.scss'

interface InsightsPanelProps {
  data: ReturnType<typeof insights>
  /** Supervisors and admins compare sellers; a seller sees their own zones. */
  bySeller: boolean
  sellerColor: (key: string) => string
  onSeller: (key: string) => void
  onArea: (key: string) => void
}

const days = (n: number | null) => (n === null ? '—' : `${Math.round(n)} ${Math.round(n) === 1 ? 'día' : 'días'}`)

function Coverage({ value }: { value: number }) {
  return (
    <span className={styles.coverage}>
      <span className={styles.track} aria-hidden><span className={styles.fill} style={{ width: `${value}%` }} /></span>
      <span className={styles.pct}>{value}%</span>
    </span>
  )
}

function GroupTable({ title, rows, swatch, onPick, firstColumn }: { title: string; rows: GroupInsight[]; swatch?: (key: string) => string; onPick: (key: string) => void; firstColumn: string }) {
  if (!rows.length) return null
  return (
    <section className={styles.block} aria-label={title}>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{firstColumn}</th>
              <th scope="col" className={styles.num}>Puntos</th>
              <th scope="col">Activados 30 días</th>
              <th scope="col" className={styles.num}>Sin visitar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">
                  <button type="button" className={styles.pick} onClick={() => onPick(r.key)} aria-label={`Ver en el mapa: ${r.label}`}>
                    {swatch ? <span className={styles.swatch} style={{ background: swatch(r.key) }} aria-hidden /> : null}
                    {r.label}
                  </button>
                </th>
                <td className={styles.num}>{r.points}</td>
                <td><Coverage value={r.coverage} /></td>
                <td className={styles.num} data-alert={r.stale > 0 || undefined} title={r.avgDays === null ? undefined : `Última activación: ${days(r.avgDays)} en promedio`}>{r.stale}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** What the map says in numbers: coverage, what is falling behind, by seller and by zone. */
export function InsightsPanel({ data, bySeller, sellerColor, onSeller, onArea }: InsightsPanelProps) {
  const t = data.total
  const unassigned = data.bySeller.find((g) => g.key === 'none')?.points ?? 0
  const tiles = [
    { label: 'Puntos de venta', value: String(t.points), hint: data.unlocated ? `${data.unlocated} sin ubicación` : 'Todos en el mapa' },
    { label: 'Activados en 30 días', value: `${t.coverage}%`, hint: `${t.active} de ${t.points}` },
    { label: 'Sin visitar hace +30 días', value: String(t.stale), hint: 'Incluye nunca activados', alert: t.stale > 0 },
    { label: 'Última activación', value: days(t.avgDays), hint: 'En promedio' },
  ]

  return (
    <div className={styles.panel}>
      <dl className={styles.tiles}>
        {tiles.map((x) => (
          <div key={x.label} className={styles.tile} data-alert={x.alert || undefined}>
            <dt className={styles.tileLabel}>{x.label}</dt>
            <dd className={styles.tileValue}>{x.value}</dd>
            <dd className={styles.tileHint}>{x.hint}</dd>
          </div>
        ))}
      </dl>
      {bySeller && unassigned > 0 ? (
        <p className={styles.notice}>
          {unassigned === 1 ? '1 punto no tiene vendedor' : `${unassigned} puntos no tienen vendedor`}: asignalos desde el Directorio para ver bien las zonas.
        </p>
      ) : null}
      {bySeller ? <GroupTable title="Por vendedor" firstColumn="Vendedor" rows={data.bySeller} swatch={sellerColor} onPick={onSeller} /> : null}
      <GroupTable title="Por zona" firstColumn="Zona" rows={data.byArea} onPick={onArea} />
    </div>
  )
}
