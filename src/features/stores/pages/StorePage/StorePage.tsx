import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Archive, ArchiveRestore, CalendarPlus, ChevronLeft, Copy, Pencil, Trash2 } from 'lucide-react'
import { formatDayMonth, formatTime, todayInArgentina } from '@/domain/dates'
import { originText, storeStats, usualDisplays } from '@/domain/stores'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useIsDesktop } from '@/lib/useMedia'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { Skeleton } from '@/ui/Skeleton'
import { StatusChip } from '@/ui/StatusChip'
import { Table } from '@/ui/Table'
import { useCatalogs } from '@/features/workday/api/queries'
import { useWorkContext } from '@/features/workday/context'
import { companyQuery } from '@/features/admin/api/company'
import { storeQuery, storeVisitsQuery, type StoreHistoryVisit } from '@/features/stores/api/stores'
import { useStoreArchive } from '@/features/stores/useStoreArchive'
import { useAutoVerify } from '@/features/stores/useAutoVerify'
import { effectiveRapport, RAPPORT_SHORT } from '@/domain/reputation'
import { useStoreReputation } from '@/features/reputation/api'
import { RapportLevel } from '@/features/reputation/components/RapportLevel'
import { EditSheet } from './EditSheet'
import { storeTags } from '@/features/workday/store-tags'
import { ReputationCard } from './ReputationCard'
import { MergeSheet } from './MergeSheet'
import { LocationCard } from './LocationCard'
import styles from './StorePage.module.scss'

const when = (v: StoreHistoryVisit) => `${v.workDate === todayInArgentina() ? 'Hoy' : formatDayMonth(v.workDate)}${v.arrivedAt ? ` · ${formatTime(v.arrivedAt)}` : ''}`
const arranged = (v: StoreHistoryVisit) => v.displays.filter((d) => v.photos.some((p) => p.displayId === d.id && p.kind === 'after')).length

/** A store: its data, location, usual displays and visit history (S07 / SM07). */
export function StorePage({ storeId }: { storeId: string }) {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const desktop = useIsDesktop()
  const store = useQuery(storeQuery(storeId))
  const visits = useQuery({ ...storeVisitsQuery(storeId, ctx?.personId ?? ''), enabled: Boolean(ctx) })
  const company = useQuery({ ...companyQuery(ctx?.companyId ?? ''), enabled: Boolean(ctx), retry: false })
  const catalogs = useCatalogs(ctx?.companyId ?? '')
  const reputation = useStoreReputation(ctx?.companyId ?? '', [storeId]).data?.get(storeId)
  const { askArchive, askRemove, restore, busy, error: archiveError, dialog } = useStoreArchive()
  const [sheet, setSheet] = useState<'edit' | 'merge' | null>(null)
  useDocumentTitle(store.data ? store.data.name ?? store.data.address : null)
  useAutoVerify(store.data && !store.data.archivedAt ? [store.data] : [])
  if (!ctx) return null
  if (store.isPending) return <div className={styles.page}><Skeleton height={320} /></div>
  const s = store.data
  if (!s) return <div className={styles.page}><Banner tone="error">Ese comercio no existe o ya no está en el directorio.</Banner></div>

  const list = visits.data ?? []
  const typeName = (id: number) => catalogs.data?.displayTypes.find((t) => t.id === id)?.name ?? 'Exhibición'
  const asStats = list.map((v) => ({ workDate: v.workDate, workStatus: v.workStatus, reviewStatus: v.reviewStatus, arrivedAt: v.arrivedAt, finishedAt: v.finishedAt, displayTypeIds: v.displays.map((d) => d.typeId) }))
  const stats = storeStats(asStats, todayInArgentina())
  const usual = usualDisplays(asStats, typeName)
  const tags = storeTags(catalogs.data, s)
  const active = !s.archivedAt && !s.mergedInto && !s.removedAt
  const target = { id: s.id, label: s.name ?? s.address }

  return (
    <div className={styles.page}>
      <Link to="/s/stores" className={styles.back}><ChevronLeft size={16} aria-hidden />Directorio</Link>
      <header className={styles.top}>
        <div className={styles.titles}>
          <span className={styles.eyebrow}>{s.customerNumber ? `Cliente ${s.customerNumber}` : 'Sin número de cliente'}</span>
          <h1 className={styles.title}>{s.name ?? s.address}</h1>
          {s.name ? <span className={styles.subtitle}>{s.address}</span> : null}
        </div>
        {active ? (
          <div className={styles.actions}>
            <Button variant="secondary" size="md" onClick={() => setSheet('edit')}><Pencil size={16} aria-hidden />Editar datos</Button>
            <Button variant="secondary" size="md" onClick={() => setSheet('merge')}><Copy size={16} aria-hidden />{desktop ? 'Fusionar duplicado' : 'Fusionar'}</Button>
            <Button size="md" onClick={() => navigate({ to: '/s/assign' })}><CalendarPlus size={16} aria-hidden />Asignar a una jornada</Button>
          </div>
        ) : null}
      </header>

      {s.mergedInto ? (
        <Banner tone="info" title="Se fusionó con otro comercio">
          Sus visitas pasaron a ese comercio. <Link to="/stores/$storeId" params={{ storeId: s.mergedInto }} className={styles.inlineLink}>Ver el comercio</Link>
        </Banner>
      ) : s.removedAt ? (
        <Banner tone="info" title={`Eliminado el ${formatDayMonth(s.removedAt.slice(0, 10))}`}>Ya no está en el directorio. Sus visitas siguen en el historial y en los informes.</Banner>
      ) : s.archivedAt ? (
        <div className={styles.archived}>
          <Banner tone="warn" title={`Archivado el ${formatDayMonth(s.archivedAt.slice(0, 10))}`}>No aparece en el directorio ni en las búsquedas ni en las jornadas. Sus visitas siguen en el historial.</Banner>
          <div className={styles.archivedActions}>
            <Button variant="secondary" size="md" loading={busy === s.id} onClick={() => restore(s.id)}><ArchiveRestore size={16} aria-hidden />Restaurar</Button>
            <Button variant="ghost" size="md" disabled={busy === s.id} onClick={() => void askRemove(target)}><Trash2 size={16} aria-hidden />Eliminar</Button>
          </div>
        </div>
      ) : null}
      {archiveError ? <Banner tone="error">{archiveError.message}</Banner> : null}

      <div className={styles.layout}>
        <LocationCard store={s} scope={company.data?.geocodingScope ?? 'caba'} canEdit={active} />

        <section className={styles.details} aria-label="Datos del comercio">
          <dl className={styles.card}>
            <div><dt>Nro. de cliente</dt><dd>{s.customerNumber ?? '—'}</dd></div>
            <div><dt>Canal</dt><dd className={tags.channel ? undefined : styles.missing}>{tags.channel ?? 'Sin canal'}</dd></div>
            <div><dt>Vendedor</dt><dd className={tags.seller ? undefined : styles.missing}>{tags.seller ?? 'Sin vendedor'}</dd></div>
            <div><dt>Alta</dt><dd>{originText(s.source, s.createdAt, s.createdByName)}</dd></div>
          </dl>
          <ReputationCard reputation={reputation} visits={list} />
          {usual.length ? (
            <div className={styles.card}>
              <span className={styles.label}>Exhibiciones habituales</span>
              <div className={styles.tags}>{usual.map((u) => <span key={u} className={styles.tag}>{u}</span>)}</div>
              <span className={styles.help}>De las últimas visitas.</span>
            </div>
          ) : null}
          {active ? (
            <Button variant="secondary" size="md" className={styles.archive} loading={busy === s.id} onClick={() => void askArchive(target)}>
              <Archive size={16} aria-hidden />Archivar comercio
            </Button>
          ) : null}
        </section>

        <section className={styles.activity} aria-label="Historial">
          <div className={styles.kpis}>
            <span className={styles.kpi}><b>{stats.last30}</b>visitas en 30 días</span>
            <span className={styles.kpi}><b>{stats.approved}</b>aprobadas</span>
            <span className={styles.kpi}><b>{stats.refused}</b>no autorizadas</span>
            <span className={styles.kpi}><b>{stats.averageMinutes === null ? '—' : `${stats.averageMinutes} min`}</b>tiempo promedio</span>
          </div>
          <h2 className={styles.heading}>Historial de visitas</h2>
          {visits.isPending ? <Skeleton height={160} /> : !list.length ? (
            <p className={styles.help}>Todavía no tiene visitas.</p>
          ) : desktop ? (
            <Table label="Visitas del comercio">
              <thead><tr><th>Fecha</th><th>Activador</th><th>Resultado</th><th>Trato</th><th>Exhibiciones</th><th>Fotos</th></tr></thead>
              <tbody>
                {list.map((v) => (
                  <tr key={v.id}>
                    <td><Link to="/review/$visitId" params={{ visitId: v.id }} className={styles.visitLink}>{when(v)}</Link></td>
                    <td>{v.merchandiserName.split(' ')[0]}</td>
                    <td><span className={styles.result}><StatusChip work={v.workStatus} review={v.reviewStatus} />{v.resumedOn ? <span className={styles.help}>retomada del {formatDayMonth(v.resumedOn)}</span> : null}</span></td>
                    <td>{effectiveRapport(v) ? <RapportLevel level={effectiveRapport(v) ?? 'welcoming'} /> : <span className={styles.help}>—</span>}</td>
                    <td>{v.displays.length ? `${arranged(v)} de ${v.displays.length}` : '—'}</td>
                    <td>{v.photos.length || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <ul className={styles.visits}>
              {list.map((v) => (
                <li key={v.id}>
                  <Link to="/review/$visitId" params={{ visitId: v.id }} className={styles.visit}>
                    <span className={styles.visitText}>
                      <span className={styles.visitWhen}>{when(v)}</span>
                      <span className={styles.help}>{v.merchandiserName.split(' ')[0]}{v.displays.length ? ` · ${arranged(v)} de ${v.displays.length} exhib.` : ''}{v.resumedOn ? ` · retomada del ${formatDayMonth(v.resumedOn)}` : ''}{effectiveRapport(v) ? ` · ${RAPPORT_SHORT[effectiveRapport(v) ?? 'welcoming']}` : ''}</span>
                    </span>
                    <StatusChip work={v.workStatus} review={v.reviewStatus} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <EditSheet store={s} open={sheet === 'edit'} onClose={() => setSheet(null)} />
      <MergeSheet store={s} open={sheet === 'merge'} onClose={() => setSheet(null)} />
      {dialog}
    </div>
  )
}
