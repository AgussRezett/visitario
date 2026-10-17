import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { addDays, todayInArgentina } from '@/domain/dates'
import { distribution, groupBy, indexOf, scoreOf, totalOf, weekly, weeksBetween } from '@/domain/reputation'
import { Banner } from '@/ui/Banner'
import { Refreshing } from '@/ui/Refreshing'
import { Segmented } from '@/ui/Segmented'
import { Skeleton } from '@/ui/Skeleton'
import { useWorkContext } from '@/features/workday/context'
import { DirectoryTabs } from '@/features/stores/components/DirectoryTabs'
import { rapportFactsQuery, useStoreReputation } from '../../api'
import { WeeklyChart } from './WeeklyChart'
import { GroupList } from './GroupList'
import { WorsenedList } from './WorsenedList'
import styles from './ReputationPage.module.scss'

/**
 * How the stores receive the merchandisers, for supervisors (their team) and admins
 * (the company): the index, week by week, stores that got worse, by area and by person.
 */
export function ReputationPage({ days }: { days: 30 | 90 }) {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const companyId = ctx?.companyId ?? ''
  const today = todayInArgentina()
  const from = addDays(today, -(days - 1))
  const facts = useQuery({ ...rapportFactsQuery(companyId, from, today), placeholderData: keepPreviousData })
  const before = useQuery(rapportFactsQuery(companyId, addDays(from, -days), addDays(from, -1)))
  const rows = useMemo(() => facts.data ?? [], [facts.data])
  const storeIds = useMemo(() => [...new Set(rows.map((f) => f.storeId))], [rows])
  const reputation = useStoreReputation(companyId, storeIds).data

  const d = distribution(rows)
  const score = scoreOf(d)
  const previous = scoreOf(distribution(before.data ?? []))
  const delta = score !== null && previous !== null ? indexOf(score) - indexOf(previous) : null
  const total = totalOf(d)
  const weeks = weekly(rows, weeksBetween(from, today))
  const byArea = groupBy(rows, (f) => ({ id: f.area ?? '', label: f.area ?? 'Sin zona' }))
  const byPerson = groupBy(rows, (f) => ({ id: f.merchandiserId, label: f.merchandiserName }))
  const names = new Map(rows.map((f) => [f.storeId, { name: f.storeName, area: f.area }]))
  const worsened = storeIds.flatMap((id) => {
    const rep = reputation?.get(id)
    const store = names.get(id)
    return rep && store && rep.trend === 'worse' ? [{ id, name: store.name, area: store.area, rep }] : []
  }).sort((a, b) => a.rep.score - b.rep.score)

  if (!ctx) return null
  return (
    <div className={styles.page}>
      <header className={styles.titles}>
        <span className={styles.eyebrow}>Clientes de {ctx.companyName}</span>
        <h1 className={styles.title}>Directorio</h1>
      </header>
      <DirectoryTabs view="reputation" />

      <div className={styles.filters}>
        <Segmented
          label="Período"
          value={String(days)}
          onChange={(v) => navigate({ to: '/s/stores', search: { view: 'reputation', days: v === '30' ? 30 : 90 } })}
          options={[{ value: '30', label: 'Últimos 30 días' }, { value: '90', label: 'Últimos 90 días' }]}
        />
      </div>

      {facts.isError ? <Banner tone="error">No pudimos cargar la reputación. Revisá la conexión.</Banner> : null}
      {facts.isPending ? (
        <Skeleton height={320} shape="block" />
      ) : !total ? (
        <Banner tone="info" title="Todavía no hay calificaciones en este período">
          Los activadores marcan cómo los reciben en la autorización de cada visita. Las visitas no autorizadas cuentan como "No quiso".
        </Banner>
      ) : (
        <Refreshing active={facts.isPlaceholderData} className={styles.body}>
          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>Índice de trato</span>
              <b className={styles.kpiValue}>{score === null ? '—' : indexOf(score)}<small>/100</small></b>
              <span className={styles.kpiNote}>
                {delta === null ? 'Sin período anterior para comparar' : delta === 0 ? `Igual que los ${days} días anteriores` : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} contra los ${days} días anteriores`}
              </span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>Con buena onda</span>
              <b className={styles.kpiValue}>{Math.round((d.welcoming / total) * 100)}<small> %</small></b>
              <span className={styles.kpiNote}>{d.welcoming} de {total} visitas calificadas</span>
            </div>
            <div className={styles.kpi}>
              <span className={styles.kpiLabel}>Empeoraron</span>
              <b className={styles.kpiValue}>{worsened.length}</b>
              <span className={styles.kpiNote}>{worsened.length === 1 ? 'comercio' : 'comercios'} de {storeIds.length} calificados</span>
            </div>
          </div>

          <WeeklyChart weeks={weeks} />

          <div className={styles.columns}>
            <WorsenedList stores={worsened} />
            <GroupList title="Por zona" rows={byArea} help="De peor a mejor trato. El índice va de 0 (no quisieron) a 100 (siempre con buena onda)." />
          </div>

          <GroupList title="Por activador" rows={byPerson} help="Cómo reciben a cada uno: si alguien tiene problemas en varios comercios, se ve acá." />
        </Refreshing>
      )}
    </div>
  )
}
