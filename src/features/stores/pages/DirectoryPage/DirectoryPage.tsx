import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Archive, ArchiveRestore, CheckCheck, ChevronLeft, ChevronRight, MapPinOff, Search, Trash2, UserRound } from 'lucide-react'
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
import { fetchAllMatching } from '@/features/stores/api/bulk'
import { useSelection } from '@/features/stores/useSelection'
import { useStoreArchive } from '@/features/stores/useStoreArchive'
import { BulkEditSheet } from './BulkEditSheet'
import { PageCheckbox, RowCheckbox } from './RowCheckbox'
import { SelectionBar } from './SelectionBar'
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
  // Marked rows stay marked across filters and pages.
  const selection = useSelection()
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState<number | null>(null)
  const [matching, setMatching] = useState(false)
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
  const allHere = rows.length > 0 && rows.every((r) => selection.has(r.id))
  const hidden = selection.rows.filter((s) => !rows.some((r) => r.id === s.id)).length
  const many = (n: number) => n.toLocaleString('es-AR')
  /** All that match: this page, or every page when there are more. */
  const selectMatching = async () => {
    setSaved(null)
    if (total <= rows.length) return selection.toggleAll(rows)
    setMatching(true)
    const all = await fetchAllMatching(companyId, { query: q, filter, area, channel, seller }).catch(() => null)
    setMatching(false)
    if (all) selection.add(all)
  }

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
      {saved !== null ? <Banner tone="ok">Listo: {saved === 1 ? 'se actualizó 1 comercio' : `se actualizaron ${many(saved)} comercios`}.</Banner> : null}
      {rows.length ? (
        <div className={styles.selectLine}>
          <Button variant="ghost" size="sm" loading={matching} onClick={() => void selectMatching()}>
            <CheckCheck size={16} aria-hidden />
            {total <= rows.length ? (allHere ? `Quitar los ${many(total)} de la selección` : `Seleccionar los ${many(total)}`) : `Seleccionar los ${many(total)} que coinciden`}
          </Button>
        </div>
      ) : null}
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
              <thead><tr><th className={styles.checkCell}><PageCheckbox rows={rows} selection={selection} /></th><th>Comercio</th><th>Cliente</th><th>Canal y vendedor</th><th>Zona</th><th>Ubicación</th><th>Trato</th><th>Última visita</th><th>Visitas 30 días</th><th><span className={styles.srOnly}>Acciones</span></th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} data-selected={selection.has(r.id) || undefined}>
                    <td className={styles.checkCell}><RowCheckbox row={r} label={name(r)} selection={selection} /></td>
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
                <li key={r.id} className={styles.item} data-selected={selection.has(r.id) || undefined}>
                  <RowCheckbox row={r} label={name(r)} selection={selection} />
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
      <SelectionBar count={selection.count} hidden={hidden} onEdit={() => { setSaved(null); setEditing(true) }} onClear={selection.clear} />
      <BulkEditSheet open={editing} onClose={() => setEditing(false)} companyId={companyId} rows={selection.rows} catalogs={catalogs} areas={counts.data?.areas ?? []}
        onSaved={(n) => { setEditing(false); selection.clear(); setSaved(n) }} />
      {dialog}
    </div>
  )
}
