import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Banner } from '@/ui/Banner'
import { Segmented } from '@/ui/Segmented'
import { MultiSelect } from '@/ui/Select'
import { Skeleton } from '@/ui/Skeleton'
import { useWorkContext } from '@/features/workday/context'
import { useCatalogs } from '@/features/workday/api/queries'
import { personOption } from '@/features/people/person-options'
import { issuesInboxQuery, useResolveIssue } from '@/features/issues/api'
import { IssueCard } from './IssueCard'
import styles from './IssuesPage.module.scss'

export interface IssuesSearch {
  tab?: 'open' | 'resolved'
}

/**
 * The novedades the activadores reported (a new order, no stock, no price...): to pass
 * them to the seller and mark them resolved. Open ones first, the newest on top.
 */
export function IssuesPage({ tab = 'open' }: IssuesSearch) {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const companyId = ctx?.companyId ?? ''
  const issues = useQuery(issuesInboxQuery(companyId, tab))
  const catalogs = useCatalogs(companyId)
  const resolve = useResolveIssue()
  const [types, setTypes] = useState<string[]>([])
  const [people, setPeople] = useState<string[]>([])

  const all = useMemo(() => issues.data ?? [], [issues.data])
  const shown = all.filter((i) => (!types.length || types.includes(String(i.typeId))) && (!people.length || people.includes(i.createdBy)))
  const typeOf = (id: number) => (catalogs.data?.issueTypes ?? []).find((t) => t.id === id)?.name ?? 'Novedad'
  const typeOptions = [...new Set(all.map((i) => i.typeId))].map((id) => ({ value: String(id), label: typeOf(id) }))
  const peopleOptions = [...new Map(all.map((i) => [i.createdBy, i.by])).entries()].map(([id, name]) => personOption(id, name, ''))
  if (!ctx) return null

  return (
    <div className={styles.page}>
      <header className={styles.titles}>
        <span className={styles.eyebrow}>{ctx.companyName}</span>
        <h1 className={styles.title}>Novedades</h1>
        <p className={styles.intro}>Lo que los activadores vieron en los locales: pedidos, falta de stock, precios. Pasale al vendedor lo suyo y marcalas resueltas.</p>
      </header>

      <Segmented label="Qué ver" value={tab} onChange={(t) => void navigate({ to: '/s/issues', search: { tab: t === 'open' ? undefined : t }, replace: true })}
        options={[{ value: 'open', label: tab === 'open' && issues.data ? `Abiertas · ${all.length}` : 'Abiertas' }, { value: 'resolved', label: 'Resueltas' }]} />

      {all.length > 1 ? (
        <div className={styles.filters}>
          {typeOptions.length > 1 ? <MultiSelect label="Tipo" hideLabel size="sm" values={types} onChange={setTypes} allLabel="Todos los tipos" noun="tipos" options={typeOptions} /> : null}
          {peopleOptions.length > 1 ? <MultiSelect label="Activador" hideLabel size="sm" values={people} onChange={setPeople} allLabel="Todo el equipo" noun="activadores" options={peopleOptions} /> : null}
        </div>
      ) : null}

      {resolve.error ? <Banner tone="error">{resolve.error.message}</Banner> : null}
      {issues.isError ? <Banner tone="error">No pudimos cargar las novedades. Revisá la conexión.</Banner> : null}
      {issues.isPending ? (
        <div className={styles.list}>{[0, 1, 2].map((i) => <Skeleton key={i} height={160} />)}</div>
      ) : !shown.length && !issues.isError ? (
        <Banner tone="info" title={tab === 'open' ? 'No hay novedades abiertas' : 'Todavía no hay novedades resueltas'}>
          {tab === 'open' ? 'Cuando un activador reporte algo desde una visita, aparece acá.' : 'Las que marques resueltas quedan acá.'}
        </Banner>
      ) : (
        <div className={styles.list}>
          {shown.map((i) => {
            const seller = catalogs.data?.sellers.find((s) => s.id === i.store.sellerId)?.name ?? null
            const channel = catalogs.data?.channels.find((c) => c.id === i.store.channelId)?.name ?? null
            return (
              <IssueCard key={i.id} issue={i} typeName={typeOf(i.typeId)} seller={seller} channel={channel} busy={resolve.isPending && resolve.variables?.id === i.id}
                onResolve={(note) => resolve.mutateAsync({ id: i.id, resolved: true, note })}
                onReopen={() => resolve.mutate({ id: i.id, resolved: false })} />
            )
          })}
        </div>
      )}
    </div>
  )
}
