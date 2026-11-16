import { percent } from '@/domain/seller-visits'
import type { SellerCoverage } from '@/features/stores/api/seller-visits'
import styles from './MonthCard.module.scss'

/** How the seller's month goes: clients visited, orders, and the target if the supervisor set one. */
export function MonthCard({ month, coverage: c }: { month: string; coverage: SellerCoverage }) {
  return (
    <section className={styles.card} aria-label={`Tu ${month}`}>
      <span className={styles.label}>Tu {month}</span>
      <div className={styles.figures}>
        <span className={styles.figure}><b>{c.visitedClients} de {c.clients}</b>clientes visitados</span>
        <span className={styles.figure}><b>{c.orders}</b>{c.orders === 1 ? 'pedido' : 'pedidos'}</span>
        <span className={styles.figure}><b>{c.activatedClients}</b>con activación</span>
      </div>
      <Bar value={c.visitedClients} max={c.clients} label="Cobertura de tu cartera" />
      {c.target ? (
        <>
          <span className={styles.target}>{c.visits} de {c.target} visitas del objetivo del mes</span>
          <Bar value={c.visits} max={c.target} label="Objetivo de visitas" />
        </>
      ) : null}
    </section>
  )
}

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const p = percent(value, max)
  return (
    <div className={styles.bar} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p} aria-valuetext={`${p} %`}>
      <span className={styles.fill} style={{ width: `${p}%` }} />
    </div>
  )
}
