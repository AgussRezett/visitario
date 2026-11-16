import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Target, UserX } from 'lucide-react'
import type { Range } from '@/domain/report-period'
import { percent, periodTarget } from '@/domain/seller-visits'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Sheet } from '@/ui/Sheet'
import { Skeleton } from '@/ui/Skeleton'
import { coverageQuery, useSellerVisits, type SellerCoverage } from '@/features/stores/api/seller-visits'
import styles from './SellersPanel.module.scss'

/**
 * The sellers in a period: how much of each portfolio they visited, with and without
 * orders, how many clients got an activation, and the visits against their target.
 */
export function SellersPanel({ companyId, range, controls }: { companyId: string; range: Range; controls: ReactNode }) {
  const coverage = useQuery(coverageQuery(companyId, range))
  const { setTarget } = useSellerVisits()
  const [editing, setEditing] = useState<SellerCoverage | null>(null)
  const [value, setValue] = useState('')
  const rows = coverage.data ?? []
  const withUser = rows.filter((r) => r.hasUser).length

  const open = (r: SellerCoverage) => {
    setValue(r.target ? String(r.target) : '')
    setEditing(r)
  }
  const save = () => editing && setTarget.mutate({ sellerId: editing.sellerId, target: Number(value) || null }, { onSuccess: () => setEditing(null) })

  return (
    <div className={styles.panel}>
      <div className={styles.bar}>{controls}</div>
      {coverage.isError ? <Banner tone="error">No pudimos cargar los vendedores. Revisá la conexión y recargá.</Banner> : null}
      {coverage.isPending ? <Skeleton height={260} /> : !rows.length ? (
        <Banner tone="info" title="Todavía no hay vendedores">Cargalos en Catálogos → Vendedores y asignales sus clientes en el directorio.</Banner>
      ) : (
        <>
          {withUser < rows.length ? (
            <p className={styles.help}>{withUser === 0 ? 'Ningún vendedor' : `${withUser} de ${rows.length} vendedores`} tiene usuario en Visitario: los que no, no registran visitas. Invitalos desde Usuarios con el rol Vendedor.</p>
          ) : null}
          <ul className={styles.list} aria-label="Vendedores">
            {rows.map((r) => {
              const goal = r.target ? periodTarget(r.target, range.from, range.to) : null
              return (
                <li key={r.sellerId} className={styles.row}>
                  <div className={styles.who}>
                    <span className={styles.name}>{r.name}</span>
                    {!r.hasUser ? <span className={styles.noUser}><UserX size={14} aria-hidden />Sin usuario</span> : null}
                  </div>
                  <dl className={styles.figures}>
                    <div><dt>Cobertura</dt><dd>{r.visitedClients}/{r.clients} <small>{percent(r.visitedClients, r.clients)} %</small></dd></div>
                    <div><dt>Visitas</dt><dd>{r.visits}{goal ? <small> de {goal}</small> : null}</dd></div>
                    <div><dt>Con pedido</dt><dd>{r.orders}</dd></div>
                    <div><dt>Sin pedido</dt><dd>{r.noOrders + r.closed}</dd></div>
                    <div><dt>Activados</dt><dd>{r.activatedClients}</dd></div>
                  </dl>
                  {goal ? (
                    <div className={styles.meter} role="meter" aria-label={`Objetivo de ${r.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent(r.visits, goal)}>
                      <span style={{ width: `${percent(r.visits, goal)}%` }} />
                    </div>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => open(r)} className={styles.target}>
                    <Target size={16} aria-hidden />{r.target ? `Objetivo: ${r.target} visitas/mes` : 'Poner objetivo'}
                  </Button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <Sheet open={Boolean(editing)} onClose={() => setEditing(null)} title="Objetivo mensual" subtitle={editing?.name}
        footer={<>
          <Button variant="secondary" size="md" onClick={() => setEditing(null)}>Cancelar</Button>
          <Button size="md" loading={setTarget.isPending} onClick={save}>Guardar</Button>
        </>}>
        <Field label="Visitas por mes" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="Ej.: 60" help="Vacío: sin objetivo. En períodos que no son un mes entero se cuenta en proporción a los días." />
        {setTarget.error ? <Banner tone="error">{setTarget.error.message}</Banner> : null}
      </Sheet>
    </div>
  )
}
