import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Archive, ArchiveRestore, ChevronLeft, ChevronRight, MapPinOff, Search, UserRound } from 'lucide-react'
import { formatDayMonth, todayInArgentina } from '@/domain/dates'
import { LOCATION_LABEL } from '@/domain/stores'
import { useDebounced } from '@/lib/useDebounced'
import { useIsDesktop } from '@/lib/useMedia'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { useConfirm } from '@/ui/ConfirmDialog'
import { Refreshing } from '@/ui/Refreshing'
import { Select } from '@/ui/Select'
import { Skeleton } from '@/ui/Skeleton'
import { StatusChip } from '@/ui/StatusChip'
import { Table } from '@/ui/Table'
import { useWorkContext } from '@/features/workday/context'
import { PAGE_SIZE, directoryCountsQuery, directoryQuery, useArchiveStore, type DirectoryFilter, type DirectoryRow } from '@/features/stores/api/stores'
import styles from './DirectoryPage.module.scss'

const when = (date: string) => (date === todayInArgentina() ? 'Hoy' : formatDayMonth(date))

/** The company's stores with their last visit (S06 / SM06). */
export function DirectoryPage() {
  const ctx = useWorkContext()
  const desktop = useIsDesktop()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<DirectoryFilter>('all')
  const [area, setArea] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const q = useDebounced(query.trim(), 300)
  const companyId = ctx?.companyId ?? ''
  const list = useQuery({ ...directoryQuery(companyId, { query: q, filter, area, page }), enabled: Boolean(ctx), placeholderData: keepPreviousData })
  const counts = useQuery({ ...directoryCountsQuery(companyId), enabled: Boolean(ctx) })
  const archive = useArchiveStore()
  const { confirm, dialog } = useConfirm()
  if (!ctx) return null

  const toggle = (f: DirectoryFilter) => { setFilter((x) => (x === f ? 'all' : f)); setPage(0) }
  const rows = list.data?.rows ?? []
  const total = list.data?.total ?? 0
  const name = (r: DirectoryRow) => r.name ?? r.address
  const last = (r: DirectoryRow) => (r.lastVisit ? `${when(r.lastVisit.date)} · ${r.lastVisit.by}` : 'Nunca')
  const archived = filter === 'archived'
  const askArchive = async (r: DirectoryRow) => {
    const ok = await confirm({
      title: `¿Archivar ${name(r)}?`,
      description: 'Sale del directorio y de las búsquedas para agregar o importar. Sus visitas quedan en el historial y lo podés restaurar desde "Archivados".',
      confirmLabel: 'Archivar',
      tone: 'danger',
    })
    if (ok) archive.mutate({ id: r.id, archived: true })
  }

  return (
    <div className={styles.page}>
      <header className={styles.titles}>
        <span className={styles.eyebrow}>Clientes de {ctx.companyName}</span>
        <h1 className={styles.title}>Directorio{counts.data ? ` · ${counts.data.total.toLocaleString('es-AR')} comercios` : ''}</h1>
      </header>

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

      {archive.error ? <Banner tone="error">{archive.error.message}</Banner> : null}
      {list.isPending ? (
        <Skeleton height={320} />
      ) : list.error ? (
        <Banner tone="error">No pudimos cargar el directorio. Revisá la conexión.</Banner>
      ) : !rows.length ? (
        <p className={styles.empty}>{archived && !q && !area ? 'No hay comercios archivados.' : q || filter !== 'all' || area ? 'Ningún comercio coincide.' : 'Todavía no hay comercios. Se suman al importar planillas o agregar direcciones.'}</p>
      ) : (
        <Refreshing active={list.isPlaceholderData}>
          {desktop ? (
            <Table label="Comercios">
              <thead><tr><th>Comercio</th><th>Cliente</th><th>Zona</th><th>Ubicación</th><th>Última visita</th><th>Visitas 30 días</th><th><span className={styles.srOnly}>Acciones</span></th></tr></thead>
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
                    <td>{r.area ?? '—'}</td>
                    <td><span className={styles.location} data-status={r.locationStatus}>{LOCATION_LABEL[r.locationStatus]}</span></td>
                    <td>
                      <span className={styles.last}>
                        <span className={styles.meta}>{last(r)}</span>
                        {r.lastVisit ? <StatusChip work={r.lastVisit.status} review={r.lastVisit.review} /> : null}
                      </span>
                    </td>
                    <td className={styles.num}>{r.visits30d}</td>
                    <td className={styles.rowAction}>
                      {archived ? (
                        <Button variant="secondary" size="sm" onClick={() => archive.mutate({ id: r.id, archived: false })}><ArchiveRestore size={16} aria-hidden />Restaurar</Button>
                      ) : (
                        <Button variant="ghost" size="sm" className={styles.iconOnly} aria-label={`Archivar ${name(r)}`} title="Archivar" onClick={() => void askArchive(r)}><Archive size={18} aria-hidden /></Button>
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
            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={16} aria-hidden />Anterior</Button>
            <Button variant="secondary" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>Siguiente<ChevronRight size={16} aria-hidden /></Button>
          </div>
        </div>
      ) : null}
      {dialog}
    </div>
  )
}
