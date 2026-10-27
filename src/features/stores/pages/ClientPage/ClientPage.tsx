import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, MapPinned, Navigation } from 'lucide-react'
import { daysBetween, formatDayMonth, todayInArgentina } from '@/domain/dates'
import { mapsSearchUrl } from '@/domain/places'
import { CONSENT_LABEL } from '@/domain/visit'
import { Banner } from '@/ui/Banner'
import { buttonClass } from '@/ui/Button'
import { Skeleton } from '@/ui/Skeleton'
import { StatusChip } from '@/ui/StatusChip'
import { useWorkContext } from '@/features/workday/context'
import { useCatalogs } from '@/features/workday/api/queries'
import { StoreTagsLine } from '@/features/workday/components/StoreTagsLine'
import { storeTags } from '@/features/workday/store-tags'
import { clientHistoryQuery } from '@/features/storemap/api'
import styles from './ClientPage.module.scss'

/** A seller's client: its profile and every activation, with what was done in each. */
export function ClientPage({ storeId }: { storeId: string }) {
  const ctx = useWorkContext()
  const companyId = ctx?.companyId ?? ''
  const history = useQuery({ ...clientHistoryQuery(companyId, storeId), enabled: Boolean(ctx) })
  const catalogs = useCatalogs(companyId).data
  if (!ctx) return null
  const back = <Link to="/s/clients" className={styles.back}><ChevronLeft size={18} aria-hidden />Mis clientes</Link>

  if (history.isPending) return <div className={styles.page}>{back}<Skeleton height={320} /></div>
  if (history.error) return <div className={styles.page}>{back}<Banner tone="error">No pudimos cargar el cliente. Revisá la conexión.</Banner></div>
  if (!history.data) return <div className={styles.page}>{back}<Banner tone="info">Este comercio no está entre tus clientes.</Banner></div>

  const { store: s, visits } = history.data
  const today = todayInArgentina()
  const in30 = visits.filter((v) => daysBetween(v.date, today) <= 30).length
  const last = visits[0]
  const tags = storeTags(catalogs, { channelId: s.channelId, sellerId: null })

  return (
    <div className={styles.page}>
      {back}
      <header className={styles.header}>
        <h1 className={styles.title}>{s.name ?? s.address}</h1>
        <p className={styles.meta}>{[s.name ? s.address : null, s.area, s.customerNumber && `Cliente ${s.customerNumber}`].filter(Boolean).join(' · ')}</p>
        <StoreTagsLine tags={{ channel: tags.channel, seller: null }} />
      </header>

      <dl className={styles.stats}>
        <div className={styles.stat}><dt>Activaciones en 30 días</dt><dd>{in30}</dd></div>
        <div className={styles.stat}><dt>Última</dt><dd>{last ? formatDayMonth(last.date) : '—'}</dd></div>
        <div className={styles.stat}><dt>En total (últimas 30)</dt><dd>{visits.length}</dd></div>
      </dl>

      <div className={styles.actions}>
        <Link to="/s/map" search={{ point: s.id }} className={buttonClass('secondary', 'md')}><MapPinned size={18} aria-hidden />Ver en el mapa</Link>
        <a href={mapsSearchUrl(s)} target="_blank" rel="noreferrer" className={buttonClass('secondary', 'md')}><Navigation size={18} aria-hidden />Cómo llegar</a>
      </div>

      <section className={styles.history} aria-label="Historial de activaciones">
        <h2 className={styles.sectionTitle}>Historial</h2>
        {!visits.length ? (
          <p className={styles.meta}>Todavía no tuvo activaciones.</p>
        ) : (
          <ol className={styles.list}>
            {visits.map((v) => (
              <li key={v.id} className={styles.visit}>
                <div className={styles.visitHead}>
                  <span className={styles.date}>{formatDayMonth(v.date, true)}</span>
                  <StatusChip work={v.status} review={v.review} />
                </div>
                <p className={styles.meta}>
                  {v.merchandiser}
                  {v.consent && v.consent !== 'yes' ? ` · ${CONSENT_LABEL[v.consent]}` : ''}
                </p>
                {v.displays.length ? <p className={styles.detail}>Exhibiciones: {v.displays.join(', ')}</p> : null}
                {v.metrics.length ? <p className={styles.detail}>{v.metrics.map((m) => `${m.name}: ${m.quantity}`).join(' · ')}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
