import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Archive, ArchiveRestore, CalendarPlus, ChevronLeft, Copy, ExternalLink, Pencil, RotateCw } from 'lucide-react'
import { mapsSearchUrl } from '@/domain/places'
import { formatDayMonth, formatTime, todayInArgentina } from '@/domain/dates'
import { LOCATION_LABEL, originText, storeStats, usualDisplays } from '@/domain/stores'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useIsDesktop } from '@/lib/useMedia'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { useConfirm } from '@/ui/ConfirmDialog'
import { Skeleton } from '@/ui/Skeleton'
import { StatusChip } from '@/ui/StatusChip'
import { Table } from '@/ui/Table'
import { useCatalogs } from '@/features/workday/api/queries'
import { useWorkContext } from '@/features/workday/context'
import { companyQuery } from '@/features/admin/api/company'
import { storeQuery, storeVisitsQuery, useArchiveStore, useStoreAdmin, type StoreHistoryVisit } from '@/features/stores/api/stores'
import { effectiveRapport, RAPPORT_SHORT } from '@/domain/reputation'
import { useStoreReputation } from '@/features/reputation/api'
import { RapportLevel } from '@/features/reputation/components/RapportLevel'
import { EditSheet } from './EditSheet'
import { ReputationCard } from './ReputationCard'
import { MergeSheet } from './MergeSheet'
import styles from './StorePage.module.scss'

const when = (v: StoreHistoryVisit) => `${v.workDate === todayInArgentina() ? 'Hoy' : formatDayMonth(v.workDate)}${v.arrivedAt ? ` · ${formatTime(v.arrivedAt)}` : ''}`
const arranged = (v: StoreHistoryVisit) => v.displays.filter((d) => v.photos.some((p) => p.displayId === d.id && p.kind === 'after')).length

const VERIFY_MESSAGE = {
  verified: { tone: 'ok', text: 'Ubicación verificada: encontramos la dirección con su altura.' },
  approximate: { tone: 'warn', text: 'Encontramos la calle pero no la altura, así que la ubicación es aproximada. Si no es ahí, cargala a mano en "Editar datos".' },
  kept: { tone: 'info', text: 'No encontramos la altura exacta: dejamos la ubicación verificada que ya tenía.' },
  not_found: { tone: 'warn', text: 'No encontramos esa dirección. Revisá cómo está escrita o cargá la ubicación a mano en "Editar datos".' },
} as const

/** A store: its data, location, usual displays and visit history (S07 / SM07). */
export function StorePage({ storeId }: { storeId: string }) {
  const ctx = useWorkContext()
  const navigate = useNavigate()
  const desktop = useIsDesktop()
  const store = useQuery(storeQuery(storeId))
  const visits = useQuery({ ...storeVisitsQuery(storeId, ctx?.personId ?? ''), enabled: Boolean(ctx) })
  const company = useQuery({ ...companyQuery(ctx?.companyId ?? ''), enabled: Boolean(ctx), retry: false })
  const catalogs = useCatalogs(ctx?.companyId ?? '')
  const { verify } = useStoreAdmin(storeId)
  const reputation = useStoreReputation(ctx?.companyId ?? '', [storeId]).data?.get(storeId)
  const archive = useArchiveStore()
  const { confirm, dialog } = useConfirm()
  const [sheet, setSheet] = useState<'edit' | 'merge' | null>(null)
  useDocumentTitle(store.data ? store.data.name ?? store.data.address : null)
  if (!ctx) return null
  if (store.isPending) return <div className={styles.page}><Skeleton height={320} /></div>
  const s = store.data
  if (!s) return <div className={styles.page}><Banner tone="error">Ese comercio no existe o ya no está en el directorio.</Banner></div>

  const list = visits.data ?? []
  const typeName = (id: number) => catalogs.data?.displayTypes.find((t) => t.id === id)?.name ?? 'Exhibición'
  const asStats = list.map((v) => ({ workDate: v.workDate, workStatus: v.workStatus, reviewStatus: v.reviewStatus, arrivedAt: v.arrivedAt, finishedAt: v.finishedAt, displayTypeIds: v.displays.map((d) => d.typeId) }))
  const stats = storeStats(asStats, todayInArgentina())
  const usual = usualDisplays(asStats, typeName)
  const maps = mapsSearchUrl(s)
  const recheck = () => verify.mutate({ address: s.address, area: s.area, scope: company.data?.geocodingScope ?? 'caba', current: s.locationStatus })
  const active = !s.archivedAt && !s.mergedInto
  const askArchive = async () => {
    const ok = await confirm({
      title: `¿Archivar ${s.name ?? s.address}?`,
      description: 'Sale del directorio y de las búsquedas para agregar o importar. Sus visitas quedan en el historial y lo podés restaurar desde "Archivados".',
      confirmLabel: 'Archivar',
      tone: 'danger',
    })
    if (ok) archive.mutate({ id: s.id, archived: true })
  }

  return (
    <div className={styles.page}>
      <Link to="/s/stores" className={styles.back}><ChevronLeft size={16} aria-hidden />Directorio</Link>
      <header className={styles.top}>
        <div className={styles.titles}>
          <span className={styles.eyebrow}>{s.customerNumber ? `Cliente ${s.customerNumber}` : 'Sin número de cliente'}</span>
          <h1 className={styles.title}>{s.name ?? s.address}</h1>
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
      ) : s.archivedAt ? (
        <div className={styles.archived}>
          <Banner tone="warn" title={`Archivado el ${formatDayMonth(s.archivedAt.slice(0, 10))}`}>No aparece en el directorio ni en las búsquedas. Sus visitas siguen en el historial.</Banner>
          <Button variant="secondary" size="md" loading={archive.isPending} onClick={() => archive.mutate({ id: s.id, archived: false })}><ArchiveRestore size={16} aria-hidden />Restaurar</Button>
        </div>
      ) : null}
      {archive.error ? <Banner tone="error">{archive.error.message}</Banner> : null}

      <div className={styles.columns}>
        <section className={styles.side} aria-label="Datos del comercio">
          <dl className={styles.card}>
            <div><dt>Dirección</dt><dd>{s.address}</dd></div>
            <div><dt>Zona</dt><dd>{s.area ?? '—'}</dd></div>
            <div><dt>Ubicación</dt><dd><span className={styles.location} data-status={s.locationStatus}>{LOCATION_LABEL[s.locationStatus]}</span></dd></div>
            <div><dt>Alta</dt><dd>{originText(s.source, s.createdAt, s.createdByName)}</dd></div>
          </dl>
          <div className={styles.row}>
            <a className={styles.link} href={maps} target="_blank" rel="noreferrer"><ExternalLink size={16} aria-hidden />Abrir en Maps</a>
            <Button variant="ghost" size="sm" loading={verify.isPending} onClick={recheck}><RotateCw size={16} aria-hidden />{s.locationStatus === 'verified' ? 'Volver a verificar' : 'Verificar dirección'}</Button>
          </div>
          {verify.data ? <Banner tone={VERIFY_MESSAGE[verify.data].tone}>{VERIFY_MESSAGE[verify.data].text}</Banner> : null}
          {verify.error ? <Banner tone="error">{verify.error.message}</Banner> : null}
          {s.lat !== null && s.lng !== null ? <p className={styles.help}>{s.lat.toFixed(5)}, {s.lng.toFixed(5)}</p> : null}
          <ReputationCard reputation={reputation} visits={list} />
          {usual.length ? (
            <div className={styles.card}>
              <span className={styles.label}>Exhibiciones habituales</span>
              <div className={styles.tags}>{usual.map((u) => <span key={u} className={styles.tag}>{u}</span>)}</div>
              <span className={styles.help}>De las últimas visitas.</span>
            </div>
          ) : null}
          {active ? (
            <Button variant="danger" size="sm" className={styles.archive} loading={archive.isPending} onClick={() => void askArchive()}>
              <Archive size={16} aria-hidden />Archivar comercio
            </Button>
          ) : null}
        </section>

        <section className={styles.main} aria-label="Historial">
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
