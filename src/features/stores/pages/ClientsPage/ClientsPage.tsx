import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronRight, MapPinned, Search, Store } from 'lucide-react'
import { formatDayMonth, todayInArgentina } from '@/domain/dates'
import { rangeFor } from '@/domain/report-period'
import { OUTCOME_LABEL } from '@/domain/seller-visits'
import { Segmented } from '@/ui/Segmented'
import { coverageQuery } from '@/features/stores/api/seller-visits'
import { MonthCard } from './MonthCard'
import { normalize } from '@/domain/import'
import { Banner } from '@/ui/Banner'
import { buttonClass } from '@/ui/Button'
import { Skeleton } from '@/ui/Skeleton'
import { StatusChip } from '@/ui/StatusChip'
import { useWorkContext } from '@/features/workday/context'
import { useCatalogs } from '@/features/workday/api/queries'
import { StoreTagsLine } from '@/features/workday/components/StoreTagsLine'
import { storeTags } from '@/features/workday/store-tags'
import { clientsQuery, type Client } from '@/features/stores/api/clients'
import styles from './ClientsPage.module.scss'

const when = (date: string) => (date === todayInArgentina() ? 'Hoy' : formatDayMonth(date))
const matches = (c: Client, q: string) => normalize(`${c.name ?? ''} ${c.address} ${c.customerNumber ?? ''}`).includes(q)

/** The seller's view: their clients, with the channel and the last activation. */
export function ClientsPage() {
  const ctx = useWorkContext()
  const companyId = ctx?.companyId ?? ''
  const clients = useQuery({ ...clientsQuery(companyId), enabled: Boolean(ctx) })
  const catalogs = useCatalogs(companyId).data
  const [query, setQuery] = useState('')
  const [show, setShow] = useState<'all' | 'pending'>('all')
  const today = todayInArgentina()
  const month = rangeFor('month', today)
  const coverage = useQuery({ ...coverageQuery(companyId, month), enabled: Boolean(ctx) })
  const monthName = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' }).format(new Date(`${today}T12:00:00Z`))
  if (!ctx) return null

  const q = normalize(query)
  const all = clients.data ?? []
  // "Por visitar": clients the seller has not been to this month.
  const pending = (c: Client) => !c.mine || c.mine.date < month.from
  const shown = (q.length >= 2 ? all.filter((c) => matches(c, q)) : all).filter((c) => show === 'all' || pending(c))
  const mine = coverage.data?.[0]
  const activated = all.filter((c) => c.visits30d > 0).length

  return (
    <div className={styles.page}>
      <header className={styles.titles}>
        <span className={styles.eyebrow}>{ctx.companyName} · vendedor</span>
        <h1 className={styles.title}>Mis clientes{clients.data ? ` · ${all.length}` : ''}</h1>
        {all.length ? <p className={styles.lead}>{activated} de {all.length} con activaciones en los últimos 30 días.</p> : null}
        {all.length ? <Link to="/s/map" className={buttonClass('secondary', 'md', styles.mapLink)}><MapPinned size={18} aria-hidden />Ver en el mapa</Link> : null}
      </header>

      {mine && all.length ? <MonthCard month={monthName} coverage={mine} /> : null}

      {all.length ? (
        <Segmented label="Qué clientes ver" value={show} onChange={setShow}
          options={[{ value: 'all', label: 'Todos' }, { value: 'pending', label: `Por visitar este mes · ${all.filter(pending).length}` }]} />
      ) : null}

      {all.length > 6 ? (
        <label className={styles.search}>
          <Search size={18} aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre, nro. de cliente o dirección" aria-label="Buscar clientes" />
        </label>
      ) : null}

      {clients.isPending ? (
        <Skeleton height={280} />
      ) : clients.error ? (
        <Banner tone="error">No pudimos cargar tus clientes. Revisá la conexión.</Banner>
      ) : !all.length ? (
        <section className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden><Store size={28} /></span>
          <h2 className={styles.emptyTitle}>Todavía no tenés clientes asignados</h2>
          <p className={styles.lead}>Cuando un admin o supervisor te asigne comercios en el directorio, los vas a ver acá con sus activaciones.</p>
        </section>
      ) : !shown.length ? (
        <p className={styles.lead}>{show === 'pending' && !q ? 'Visitaste a todos tus clientes este mes.' : 'Ningún cliente coincide.'}</p>
      ) : (
        <ul className={styles.list}>
          {shown.map((c) => (
            <li key={c.id}>
              <Link to="/s/clients/$storeId" params={{ storeId: c.id }} className={styles.row} aria-label={`Ver ${c.name ?? c.address}: ficha e historial`}>
              <span className={styles.rowText}>
                <span className={styles.name}>{c.name ?? c.address}</span>
                <span className={styles.meta}>{[c.name ? c.address : null, c.customerNumber && `Cliente ${c.customerNumber}`, c.area].filter(Boolean).join(' · ')}</span>
                <StoreTagsLine tags={{ channel: storeTags(catalogs, { channelId: c.channelId, sellerId: null }).channel, seller: null }} />
                <span className={styles.meta}>{c.mine ? `Tu visita: ${when(c.mine.date)} · ${OUTCOME_LABEL[c.mine.outcome]}` : 'Todavía no lo visitaste'}</span>
              </span>
              <span className={styles.last}>
                {c.lastVisit ? (
                  <>
                    <StatusChip work={c.lastVisit.status} review={c.lastVisit.review} />
                    <span className={styles.meta}>{when(c.lastVisit.date)}{c.lastVisit.by ? ` · ${c.lastVisit.by}` : ''}</span>
                  </>
                ) : (
                  <span className={styles.meta}>Sin activaciones</span>
                )}
              </span>
              <ChevronRight size={18} className={styles.chevron} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
