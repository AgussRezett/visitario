import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Store } from 'lucide-react'
import { formatDayMonth, todayInArgentina } from '@/domain/dates'
import { normalize } from '@/domain/import'
import { Banner } from '@/ui/Banner'
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
  if (!ctx) return null

  const q = normalize(query)
  const all = clients.data ?? []
  const shown = q.length >= 2 ? all.filter((c) => matches(c, q)) : all
  const activated = all.filter((c) => c.visits30d > 0).length

  return (
    <div className={styles.page}>
      <header className={styles.titles}>
        <span className={styles.eyebrow}>{ctx.companyName} · vendedor</span>
        <h1 className={styles.title}>Mis clientes{clients.data ? ` · ${all.length}` : ''}</h1>
        {all.length ? <p className={styles.lead}>{activated} de {all.length} con activaciones en los últimos 30 días.</p> : null}
      </header>

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
        <p className={styles.lead}>Ningún cliente coincide.</p>
      ) : (
        <ul className={styles.list}>
          {shown.map((c) => (
            <li key={c.id} className={styles.row}>
              <span className={styles.rowText}>
                <span className={styles.name}>{c.name ?? c.address}</span>
                <span className={styles.meta}>{[c.name ? c.address : null, c.customerNumber && `Cliente ${c.customerNumber}`, c.area].filter(Boolean).join(' · ')}</span>
                <StoreTagsLine tags={{ channel: storeTags(catalogs, { channelId: c.channelId, sellerId: null }).channel, seller: null }} />
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
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
