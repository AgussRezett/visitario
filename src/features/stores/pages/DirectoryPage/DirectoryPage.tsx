import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Archive, ArchiveRestore, ChevronLeft, ChevronRight, MapPinOff, Search, Trash2, UserRound } from 'lucide-react'
import { formatDayMonth, todayInArgentina } from '@/domain/dates'
import { LOCATION_LABEL } from '@/domain/stores'
import type { StoreReputation } from '@/domain/reputation'
import { useDebounced } from '@/lib/useDebounced'
import { useIsDesktop } from '@/lib/useMedia'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Refreshing } from '@/ui/Refreshing'
import { Select } from '@/ui/Select'
import { Skeleton } from '@/ui/Skeleton'
import { StatusChip } from '@/ui/StatusChip'
import { Table } from '@/ui/Table'
import { useWorkContext } from '@/features/workday/context'
import { useCatalogs } from '@/features/workday/api/queries'
import { StoreTagsLine } from '@/features/workday/components/StoreTagsLine'
import { storeTags } from '@/features/workday/store-tags'
import { useStoreReputation } from '@/features/reputation/api'
import { DirectoryTabs } from '@/features/stores/components/DirectoryTabs'
import { RapportLevel } from '@/features/reputation/components/RapportLevel'
import { PAGE_SIZE, directoryCountsQuery, directoryQuery, type DirectoryFilter, type DirectoryRow } from '@/features/stores/api/stores'
import { useStoreArchive } from '@/features/stores/useStoreArchive'
import styles from './DirectoryPage.module.scss'

const when = (date: string) => (date === todayInArgentina() ? 'Hoy' : formatDayMonth(date))

/** The company's stores with their last visit (S06 / SM06). */
export function DirectoryPage() {
  const ctx = useWorkContext()
  const desktop = useIsDesktop()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<DirectoryFilter>('all')
  const [area, setArea] = useState<string | null>(null)
  /** An id, 0 for "without", null for all. */
  const [channel, setChannel] = useState<number | null>(null)
  const [seller, setSeller] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const q = useDebounced(query.trim(), 300)
  const companyId = ctx?.companyId ?? ''
  const list = useQuery({ ...directoryQuery(companyId, { query: q, filter, area, channel, seller, page }), enabled: Boolean(ctx), placeholderData: keepPreviousData })
  const counts = useQuery({ ...directoryCountsQuery(companyId), enabled: Boolean(ctx) })
  const catalogs = useCatalogs(companyId).data
  const reputation = useStoreReputation(companyId, (list.data?.rows ?? []).map((r) => r.id)).data
  const { askArchive, askRemove, restore, busy, error: archiveError, dialog } = useStoreArchive()
  if (!ctx) return null

  const toggle = (f: DirectoryFilter) => { setFilter((x) => (x === f ? 'all' : f)); setPage(0) }
  const rows = list.data?.rows ?? []
  const total = list.data?.total ?? 0
  const name = (r: DirectoryRow) => r.name ?? r.address
  const last = (r: DirectoryRow) => (r.lastVisit ? `${when(r.lastVisit.date)} · ${r.lastVisit.by}` : 'Nunca')
  const archived = filter === 'archived'
  const tagsOf = (r: DirectoryRow) => storeTags(catalogs, r)
  const pick = (value: string) => (value === '' ? null : Number(value))
  const channels = catalogs?.channels ?? []
  const sellers = catalogs?.sellers ?? []

  return (
    <div className={styles.page}>
      <header className={styles.titles}>
        <span className={styles.eyebrow}>Clientes de {ctx.companyName}</span>
        <h1 className={styles.title}>Directorio{counts.data ? ` · ${counts.data.total.toLocaleString('es-AR')} comercios` : ''}</h1>
      </header>
      <DirectoryTabs view="stores" />

      <div className={styles.filters}>
        <label className={styles.search}>
          <Search size={18} aria-hidden />
          <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0) }} placeholder="Nombre, nro. de cliente o dirección" aria-label="Buscar comercios" />
        </label>
        <div className={styles.chips}>
          {counts.data?.areas.length ? (
            <Select label="Zona" value={area ?? ''} onChange={(e) => { setArea(e.target.value || null); setPage(0) }} className={styles.area}
              options={[{ value: '', label: 'Zona: todas' }, ...counts.data.areas.map((a) => ({ value: a, label: a }))]} />
          ) : null}
          {channels.length ? (
            <Select label="Canal" value={channel === null ? '' : String(channel)} onChange={(e) => { setChannel(pick(e.target.value)); setPage(0) }} className={styles.area}
              options={[{ value: '', label: 'Canal: todos' }, { value: '0', label: 'Sin canal' }, ...channels.map((c) => ({ value: String(c.id), label: c.name }))]} />
          ) : null}
          {sellers.length ? (
            <Select label="Vendedor" value={seller === null ? '' : String(seller)} onChange={(e) => { setSeller(pick(e.target.value)); setPage(0) }} className={styles.area}
              options={[{ value: '', label: 'Vendedor: todos' }, { value: '0', label: 'Sin vendedor' }, ...sellers.map((s) => ({ value: String(s.id), label: s.name }))]} />
          ) : null}
          <button type="button" className={styles.chip} aria-pressed={filter === 'unverified'} data-tone="warn" onClick={() => toggle('unverified')}>
            <MapPinOff size={16} aria-hidden />Sin ubicación · {counts.data?.unverified ?? 0}
          </button>
          <button type="button" className={styles.chip} aria-pressed={filter === 'added'} onClick={() => toggle('added')}>
            <UserRound size={16} aria-hidden />Agregados por activadores · {counts.data?.added ?? 0}
          </button>
          {counts.data?.archived || archived ? (
            <button type="button" className={styles.chip} aria-pressed={archived} onClick={() => toggle('archived')}>
              <Archive size={16} aria-hidden />Archivados · {counts.data?.archived ?? 0}
            </button>
          ) : null}
        </div>
      </div>

      {archiveError ? <Banner tone="error">{archiveError.message}</Banner> : null}
      {list.isPending ? (
        <Skeleton height={320} />
      ) : list.error ? (
        <Banner tone="error">No pudimos cargar el directorio. Revisá la conexión.</Banner>
      ) : !rows.length ? (
        <p className={styles.empty}>{archived && !q && !area ? 'No hay comercios archivados.' : q || filter !== 'all' || area || channel !== null || seller !== null ? 'Ningún comercio coincide.' : 'Todavía no hay comercios. Se suman al importar planillas o agregar direcciones.'}</p>
      ) : (
        <Refreshing active={list.isPlaceholderData}>
          {desktop ? (
            <Table label="Comercios">
              <thead><tr><th>Comercio</th><th>Cliente</th><th>Canal y vendedor</th><th>Zona</th><th>Ubicación</th><th>Trato</th><th>Última visita</th><th>Visitas 30 días</th><th><span className={styles.srOnly}>Acciones</span></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link to="/stores/$storeId" params={{ storeId: r.id }} className={styles.store}>
                        <span className={styles.name}>{name(r)}{r.source === 'merchandiser' && r.createdByName ? <span className={styles.added}>Agregado por {r.createdByName}</span> : null}</span>
                        <span className={styles.meta}>{r.name ? r.address : 'Sin nombre'}</span>
                      </Link>
                    </td>
                    <td className={styles.num}>{r.customerNumber ?? '—'}</td>
                    <td>
                      <span className={styles.tagCell}>
                        <span className={tagsOf(r).channel ? undefined : styles.meta}>{tagsOf(r).channel ?? 'Sin canal'}</span>
                        <span className={styles.meta}>{tagsOf(r).seller ?? 'Sin vendedor'}</span>
                      </span>
                    </td>
                    <td>{r.area ?? '—'}</td>
                    <td><span className={styles.location} data-status={r.locationStatus}>{LOCATION_LABEL[r.locationStatus]}</span></td>
                    <td>{reputation?.get(r.id) ? <RapportLevel level={(reputation.get(r.id) as StoreReputation).level} trend={(reputation.get(r.id) as StoreReputation).trend} /> : <span className={styles.meta}>Sin datos</span>}</td>
                    <td>
                      <span className={styles.last}>
                        <span className={styles.meta}>{last(r)}</span>
                        {r.lastVisit ? <StatusChip work={r.lastVisit.status} review={r.lastVisit.review} /> : null}
                      </span>
                    </td>
                    <td className={styles.num}>{r.visits30d}</td>
                    <td className={styles.rowAction}>
                      {archived ? (
                        <span className={styles.rowButtons}>
                          <Button variant="secondary" size="md" loading={busy === r.id} onClick={() => restore(r.id)}><ArchiveRestore size={16} aria-hidden />Restaurar</Button>
                          <Button variant="ghost" size="md" disabled={busy === r.id} onClick={() => void askRemove({ id: r.id, label: name(r) })}><Trash2 size={16} aria-hidden />Eliminar</Button>
                        </span>
                      ) : (
                        <Button variant="ghost" size="md" loading={busy === r.id} onClick={() => void askArchive({ id: r.id, label: name(r) })}><Archive size={16} aria-hidden />Archivar</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <ul className={styles.list}>
              {rows.map((r) => (
                <li key={r.id}>
                  <Link to="/stores/$storeId" params={{ storeId: r.id }} className={styles.row}>
                    <span className={styles.rowText}>
                      <span className={styles.name}>{name(r)}</span>
                      <span className={styles.meta}>
                        {[r.name ? r.address : null, r.customerNumber, r.source === 'merchandiser' && r.createdByName ? `agregado por ${r.createdByName}` : r.area, r.locationStatus === 'verified' ? null : 'sin verificar'].filter(Boolean).join(' · ')}
                      </span>
                      <StoreTagsLine tags={tagsOf(r)} />
                      {reputation?.get(r.id) ? <RapportLevel level={(reputation.get(r.id) as StoreReputation).level} trend={(reputation.get(r.id) as StoreReputation).trend} /> : null}
                    </span>
                    <span className={styles.rowLast}>{r.lastVisit ? when(r.lastVisit.date) : 'Nunca'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Refreshing>
      )}

      {total > PAGE_SIZE ? (
        <div className={styles.pager}>
          <span className={styles.meta}>Mostrando {page * PAGE_SIZE + 1} a {Math.min(total, (page + 1) * PAGE_SIZE)} de {total.toLocaleString('es-AR')}</span>
          <div className={styles.pagerButtons}>
            <Button variant="secondary" size="md" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={16} aria-hidden />Anterior</Button>
            <Button variant="secondary" size="md" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Siguiente<ChevronRight size={16} aria-hidden /></Button>
          </div>
        </div>
      ) : null}
      {dialog}
    </div>
  )
}
