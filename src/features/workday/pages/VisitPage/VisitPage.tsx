import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { canWork, isLocked } from '@/domain/visit'
import { todayInArgentina } from '@/domain/dates'
import { Banner } from '@/ui/Banner'
import { StatusChip } from '@/ui/StatusChip'
import { useWorkContext } from '@/features/workday/context'
import { useCatalogs, visitFromLists, visitQuery, visitsQuery, type Catalogs, type Photo, type Visit } from '@/features/workday/api/queries'
import { usePhotoUrls } from '@/features/workday/api/photos'
import { useVisitView } from '@/features/sync/hooks'
import { SyncStatus } from '@/features/sync/components/SyncStatus'
import { PhotoViewer } from '@/features/workday/components/PhotoViewer'
import { VisitSkeleton } from '@/features/workday/components/Skeletons'
import { originLabel } from '@/features/workday/visit-text'
import { useVisitActions } from './useVisitActions'
import { StoreInfo } from './StoreInfo'
import { PhotoStrip } from './PhotoStrip'
import { ArrivalSection } from './ArrivalSection'
import { ConsentSection } from './ConsentSection'
import { DisplaysSection } from './DisplaysSection'
import { WorkSection } from './WorkSection'
import { MessagesSection } from './MessagesSection'
import { OperationHere } from '@/features/operation/components/OperationHere'
import { storeTags } from '@/features/workday/store-tags'
import { FinishBar } from './FinishBar'
import { RemoveStop } from './RemoveStop'
import { CorrectionPanel } from './CorrectionPanel'
import styles from './VisitPage.module.scss'

export interface ViewerState {
  photos: Photo[]
  startId: string
  title: string
}

/** One visit in a single screen: arrival, consent, displays, work, messages (wireframes A09–A11, AD09, AD10). */
export function VisitPage({ visitId }: { visitId: string }) {
  const ctx = useWorkContext()
  const qc = useQueryClient()
  const visit = useQuery({
    ...visitQuery(visitId, ctx?.personId ?? ''),
    enabled: Boolean(ctx),
    initialData: () => visitFromLists(qc, visitId)?.data,
    initialDataUpdatedAt: () => visitFromLists(qc, visitId)?.updatedAt,
  })
  const v = useVisitView(visit.data)
  const siblings = useQuery({ ...visitsQuery(v?.workdayId ?? '', ctx?.personId ?? ''), enabled: Boolean(v && ctx) })
  const catalogs = useCatalogs(v?.companyId ?? '')
  const urlFor = usePhotoUrls(v?.photos.map((p) => p.id) ?? [])
  const [viewer, setViewer] = useState<ViewerState | null>(null)
  const [displayToOpen, setDisplayToOpen] = useState<{ id: string; kind: 'before' | 'after' } | null>(null)

  if (!ctx) return null
  if (visit.isError) return <div className={styles.page}><Banner tone="error">No pudimos cargar la visita. Revisá la conexión.</Banner></div>
  if (visit.isPending) return <VisitSkeleton />
  if (!v) return <div className={styles.page}><Banner tone="error">Esa visita no existe o no es tuya.</Banner></div>

  const stop = (siblings.data?.findIndex((s) => s.id === v.id) ?? -1) + 1
  const back = { to: '/s/workday' as const, search: v.workDate === todayInArgentina() ? {} : { date: v.workDate } }
  const meta = [stop ? `Parada ${stop}` : null, originLabel(v)].filter(Boolean).join(' · ')
  const title = v.store.name ?? v.store.address
  const working = canWork(v.consent)

  return (
    <VisitBody key={v.id} visit={v} title={title} meta={meta} back={back} catalogs={catalogs.data} urlFor={urlFor} working={working} onView={setViewer} displayToOpen={displayToOpen} setDisplayToOpen={setDisplayToOpen} viewer={viewer} firstName={ctx.firstName} meId={ctx.personId} />
  )
}

type Back = { to: '/s/workday'; search: { date?: string } }

function VisitBody(props: {
  visit: Visit
  title: string
  meta: string
  back: Back
  catalogs: Catalogs | undefined
  urlFor: (id: string) => string | undefined
  working: boolean
  viewer: ViewerState | null
  onView: (v: ViewerState | null) => void
  displayToOpen: { id: string; kind: 'before' | 'after' } | null
  setDisplayToOpen: (d: { id: string; kind: 'before' | 'after' } | null) => void
  firstName: string
  meId: string
}) {
  const { visit: v, title, meta, back, catalogs, urlFor, working, viewer, onView, firstName, meId } = props
  const actions = useVisitActions(v)
  const storefront = v.photos.filter((p) => p.kind === 'storefront')
  const closed = v.consent === 'closed'
  const tags = storeTags(catalogs, v.store)

  return (
    <div className={styles.page}>
      <header className={styles.appbar}>
        <Link {...back} className={styles.back} aria-label="Volver a la jornada">
          <ChevronLeft size={24} aria-hidden />
        </Link>
        <span className={styles.appbarTitles}>
          <span className={styles.appbarTitle}>{title}</span>
          <span className={styles.appbarMeta}>{meta}</span>
        </span>
        <SyncStatus />
        <StatusChip work={v.workStatus} review={v.reviewStatus} />
      </header>

      {/* Phones: the only part that scrolls, between the top bar and the finish bar */}
      <div className={styles.scroll} data-scroll>
        <div className={styles.desktopTop}>
          <Link {...back} className={styles.crumb}>Mi jornada</Link>
          <div className={styles.desktopTitleRow}>
            <h1 className={styles.desktopTitle}>{title}</h1>
            <StatusChip work={v.workStatus} review={v.reviewStatus} />
          </div>
          <span className={styles.desktopMeta}>{[meta, v.task && `Tarea: ${v.task}`].filter(Boolean).join(' · ')}</span>
        </div>

        <div className={styles.content}>
          <OperationHere visit={v} meId={meId} firstName={firstName} />
          <StoreInfo visit={v} tags={tags} />
          <CorrectionPanel
            visit={v}
            actions={actions}
            meId={meId}
            displayLabel={(id) => {
              const i = v.displays.findIndex((d) => d.id === id)
              const d = v.displays[i]
              return d ? `Exhibición ${i + 1} · ${catalogs?.displayTypes.find((t) => t.id === d.typeId)?.name ?? ''}` : undefined
            }}
          />
          <PhotoStrip
            visit={v}
            working={working}
            onArrive={actions.arrive}
            onViewStorefront={() => storefront[0] && onView({ photos: storefront, startId: storefront[0].id, title: 'Fachada' })}
            onDisplayPhoto={(kind) => {
              const target = v.displays.find((d) => !v.photos.some((p) => p.displayId === d.id && p.kind === kind)) ?? v.displays[0]
              if (target) props.setDisplayToOpen({ id: target.id, kind })
            }}
            busy={actions.uploading}
          />

          <div className={styles.columns}>
            <div className={styles.column}>
              <div className={styles.arrival}>
                <ArrivalSection visit={v} urlFor={urlFor} onArrive={actions.arrive} busy={actions.uploading} onView={(id) => onView({ photos: storefront, startId: id, title: 'Fachada' })} />
              </div>
              <div className={styles.consent}>
                <ConsentSection visit={v} actions={actions} />
              </div>
              {working && catalogs ? (
                <div className={styles.work}>
                  <WorkSection visit={v} catalogs={catalogs} onNotes={actions.setNotes} />
                </div>
              ) : null}
            </div>
            <div className={styles.column}>
              {working && catalogs ? (
                <div className={styles.displays}>
                  <DisplaysSection
                    visit={v}
                    catalogs={catalogs}
                    urlFor={urlFor}
                    actions={actions}
                    openDisplay={props.displayToOpen}
                    onOpened={() => props.setDisplayToOpen(null)}
                    onView={onView}
                  />
                </div>
              ) : closed ? (
                <p className={styles.help}>Exhibiciones y trabajo se habilitan cuando el local te autorice.</p>
              ) : null}
              {catalogs && catalogs.showWhatsapp !== false ? (
                <div className={styles.messages}>
                  <MessagesSection visit={v} templates={catalogs.templates} firstName={firstName} typeName={(id) => catalogs.displayTypes.find((t) => t.id === id)?.name ?? 'Exhibición'} tags={tags} perDisplay={catalogs.messagesPerDisplay} />
                </div>
              ) : null}
              <div className={styles.finish}>
                <FinishBar visit={v} actions={actions} back={back} />
              </div>
            </div>
          </div>
          <RemoveStop visit={v} back={back} />
        </div>
      </div>

      <div className={styles.footer}>
        <FinishBar visit={v} actions={actions} back={back} />
      </div>

      <PhotoViewer
        photos={viewer?.photos ?? []}
        startId={viewer?.startId ?? null}
        title={viewer?.title ?? ''}
        subtitle={title}
        urlFor={urlFor}
        onClose={() => onView(null)}
        onReplace={isLocked(v) ? undefined : async (p, file) => {
          onView(null)
          await actions.replacePhoto(p.id, file)
        }}
        onRetry={(p) => actions.retryPhoto(p.id)}
        onDelete={isLocked(v) ? undefined : async (p) => {
          onView(null)
          await actions.deletePhoto(p.id)
        }}
      />
    </div>
  )
}
