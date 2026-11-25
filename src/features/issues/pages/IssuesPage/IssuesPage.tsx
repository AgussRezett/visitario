import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Banner } from '@/ui/Banner'
import { Segmented } from '@/ui/Segmented'
import { MultiSelect } from '@/ui/Select'
import { Skeleton } from '@/ui/Skeleton'
import { useWorkContext } from '@/features/workday/context'
import { useCatalogs } from '@/features/workday/api/queries'
import { personOption } from '@/features/people/person-options'
import { formatLongDate, todayInArgentina } from '@/domain/dates'
import { dayTitle, groupIssues, isNewIssue, issueTime, issueWhen } from '@/domain/issues'
import { readLocal, writeLocal } from '@/lib/storage'
import { issuesInboxQuery, useResolveIssue } from '@/features/issues/api'
import { IssueCard } from './IssueCard'
import styles from './IssuesPage.module.scss'

export interface IssuesSearch {
  tab?: 'open' | 'resolved'
  /** Sections by the day they were reported (default) or by type. */
  by?: 'day' | 'type'
}

/**
 * The novedades the activadores reported (a new order, no stock, no price...): to pass
 * them to the seller and mark them resolved. Open ones first, the newest on top.
 */
export function IssuesPage({ tab = 'open', by = 'day' }: IssuesSearch) {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const companyId = ctx?.companyId ?? ''
  const issues = useQuery(issuesInboxQuery(companyId, tab))
  const catalogs = useCatalogs(companyId)
  const resolve = useResolveIssue()
  const [types, setTypes] = useState<string[]>([])
  const [people, setPeople] = useState<string[]>([])
  // What came in since this list was last opened here is marked "Nueva".
  const seenKey = `visitario.issuesSeen.${companyId}`
  const [lastSeen] = useState(() => readLocal(seenKey))
  useEffect(() => {
    if (companyId) writeLocal(seenKey, new Date().toISOString())
  }, [companyId, seenKey])

  const all = useMemo(() => issues.data ?? [], [issues.data])
  const shown = all.filter((i) => (!types.length || types.includes(String(i.typeId))) && (!people.length || people.includes(i.createdBy)))
  const typeOf = (id: number) => (catalogs.data?.issueTypes ?? []).find((t) => t.id === id)?.name ?? 'Novedad'
  const typeOrder = (catalogs.data?.issueTypes ?? []).map((t) => t.id)
  const groups = groupIssues(shown, by, { day: (d) => dayTitle(d, todayInArgentina(), formatLongDate), type: typeOf }, typeOrder)
  const freshCount = tab === 'open' ? all.filter((i) => isNewIssue(i.createdAt, lastSeen)).length : 0
  const typeOptions = [...new Set(all.map((i) => i.typeId))].map((id) => ({ value: String(id), label: typeOf(id) }))
  const peopleOptions = [...new Map(all.map((i) => [i.createdBy, i.by])).entries()].map(([id, name]) => personOption(id, name, ''))
  if (!ctx) return null
  const asSeller = ctx.role === 'seller'

  return (
    <div className={styles.page}>
      <header className={styles.titles}>
        <span className={styles.eyebrow}>{ctx.companyName}</span>
        <h1 className={styles.title}>{asSeller ? 'Novedades de mis clientes' : 'Novedades'}</h1>
        <p className={styles.intro}>
          {asSeller
            ? 'Lo que los activadores vieron en tus clientes: pedidos, falta de stock, precios. Cuando lo resuelvas, marcalo y el supervisor se entera.'
            : 'Lo que los activadores vieron en los locales: pedidos, falta de stock, precios. Pasale al vendedor lo suyo y marcalas resueltas.'}
        </p>
      </header>

      <Segmented label="Qué ver" value={tab} onChange={(t) => void navigate({ to: '/s/issues', search: { tab: t === 'open' ? undefined : t, by: by === 'day' ? undefined : by }, replace: true })}
        options={[{ value: 'open', label: tab === 'open' && issues.data ? `Abiertas · ${all.length}` : 'Abiertas' }, { value: 'resolved', label: 'Resueltas' }]} />

      {freshCount ? <p className={styles.fresh}>{freshCount === 1 ? '1 novedad nueva' : `${freshCount} novedades nuevas`} desde la última vez que entraste.</p> : null}

      {all.length > 1 ? (
        <div className={styles.filters}>
          <Segmented label="Agrupar" value={by} onChange={(b) => void navigate({ to: '/s/issues', search: { tab: tab === 'open' ? undefined : tab, by: b === 'day' ? undefined : b }, replace: true })}
            options={[{ value: 'day', label: 'Por día' }, { value: 'type', label: 'Por tipo' }]} />
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
          {tab === 'open' ? (asSeller ? 'Cuando un activador reporte algo de uno de tus clientes, aparece acá.' : 'Cuando un activador reporte algo desde una visita, aparece acá.') : 'Las que marques resueltas quedan acá.'}
        </Banner>
      ) : (
        groups.map((g) => (
          <section key={g.key} className={styles.group} aria-label={g.title}>
            <h2 className={styles.groupTitle}>{g.title}<span className={styles.groupCount}>{g.items.length}</span></h2>
            <div className={styles.list}>
              {g.items.map((i) => {
                const seller = catalogs.data?.sellers.find((s) => s.id === i.store.sellerId)?.name ?? null
                const channel = catalogs.data?.channels.find((c) => c.id === i.store.channelId)?.name ?? null
                return (
                  <IssueCard key={i.id} issue={i} typeName={typeOf(i.typeId)} seller={seller} channel={channel} asSeller={asSeller} busy={resolve.isPending && resolve.variables?.id === i.id}
                    when={by === 'day' ? issueTime(i.createdAt) : issueWhen(i.createdAt)} fresh={tab === 'open' && isNewIssue(i.createdAt, lastSeen)}
                    onResolve={(note) => resolve.mutateAsync({ id: i.id, resolved: true, note })}
                    onReopen={() => resolve.mutate({ id: i.id, resolved: false })} />
                )
              })}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
