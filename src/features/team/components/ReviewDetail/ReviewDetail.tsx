import { useMemo, useState } from 'react'
import { reviewBlock, type ReviewDraft } from './review-draft'
import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { Check, MessageSquareWarning, Store } from 'lucide-react'
import { CONSENT_LABEL, WORK_STATUS_LABEL } from '@/domain/visit'
import { canRequestFix } from '@/domain/team'
import { formatTime } from '@/domain/dates'
import { Banner } from '@/ui/Banner'
import { Button, buttonClass } from '@/ui/Button'
import { Select } from '@/ui/Select'
import { StatusChip } from '@/ui/StatusChip'
import { TextArea } from '@/ui/TextArea'
import { useCatalogs, visitWorkQuery, type Photo } from '@/features/workday/api/queries'
import { commentsQuery, visitEventsQuery } from '@/features/workday/api/comments'
import { usePhotoUrls } from '@/features/workday/api/photos'
import { PhotoThumb } from '@/features/workday/components/PhotoThumb'
import { PhotoViewer } from '@/features/workday/components/PhotoViewer'
import { Conversation } from '@/features/workday/components/Conversation'
import { StoreTagsLine } from '@/features/workday/components/StoreTagsLine'
import { storeTags } from '@/features/workday/store-tags'
import type { TeamVisit } from '@/features/team/api/queries'
import { useCropPhoto, useReview } from '@/features/team/api/mutations'
import styles from './ReviewDetail.module.scss'

const EVENT_TEXT: Record<string, string> = {
  in_progress: 'llegada', done: 'terminada', refused: 'no autorizada', closed: 'cerrado', pending: 'volvió a pendiente',
  approved: 'aprobada', needs_fix: 'pidió corrección', unreviewed: 'reenviada',
}

const minutesBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000)

/** Everything the supervisor needs to judge a visit (S02 / SM02). */
/** The work of a visit (metrics, brands), when it comes with the visit instead of being asked. */
export interface VisitWork { metrics: Record<number, number>; brands: number[] }

/**
 * A visit in full: store, result, photos, work and notes. For a supervisor, with the
 * conversation and the review form; `readOnly` (an activador looking at the store's
 * history) leaves only what happened, with its work handed in.
 */
export function ReviewDetail({ visit: v, meId, draft, readOnly = false, work: given }: { visit: TeamVisit; meId: string; draft?: ReviewDraft; readOnly?: boolean; work?: VisitWork }) {
  const catalogs = useCatalogs(v.companyId)
  const asked = useQuery({ ...visitWorkQuery(v.id), enabled: !given })
  const work = { data: given ?? asked.data }
  const comments = useQuery({ ...commentsQuery(v.id), enabled: !readOnly })
  const events = useQuery({ ...visitEventsQuery(v.id), enabled: !readOnly })
  const urlFor = usePhotoUrls(v.photos.map((p) => p.id))
  const cropPhoto = useCropPhoto()
  const [viewer, setViewer] = useState<{ photos: Photo[]; startId: string; title: string } | null>(null)

  const typeName = (id: number) => catalogs.data?.displayTypes.find((t) => t.id === id)?.name ?? 'Exhibición'
  const displayLabel = (id: string) => {
    const i = v.displays.findIndex((d) => d.id === id)
    const d = v.displays[i]
    return d ? `${i + 1} ${typeName(d.typeId)}${d.reference ? ` · ${d.reference}` : ''}` : undefined
  }
  const arranged = v.displays.filter((d) => v.photos.some((p) => p.displayId === d.id && p.kind === 'after')).length
  const by = v.addedByName ? `agregada por ${v.addedByName}` : 'asignada'
  const origin = v.source === 'added' ? `extra del día · ${by}` : by
  const metrics = useMemo(
    () => (catalogs.data?.metrics ?? []).map((m) => ({ name: m.name, qty: work.data?.metrics[m.id] ?? 0 })).filter((m) => m.qty > 0),
    [catalogs.data, work.data],
  )
  const brands = (work.data?.brands ?? []).map((id) => catalogs.data?.brands.find((b) => b.id === id)?.name).filter(Boolean)

  const shots = [
    ...v.photos.filter((p) => p.kind === 'storefront').map((p) => ({ p, caption: `Fachada · ${formatTime(p.takenAt)}` })),
    ...v.displays.flatMap((d) =>
      v.photos.filter((p) => p.displayId === d.id).map((p) => ({ p, caption: `${displayLabel(d.id)?.split(' · ')[0]} · ${p.kind === 'before' ? 'antes' : 'después'}` })),
    ),
  ]
  const here = useRouterState({ select: (r) => r.location.href })
  const withoutPhotos = v.displays.filter((d) => !v.photos.some((p) => p.displayId === d.id))

  return (
    <div className={styles.detail}>
      <section className={styles.card}>
        <div className={styles.head}>
          <div className={styles.titles}>
            <h2 className={styles.title}>{v.store.name ?? v.store.address}</h2>
            <span className={styles.muted}>{[v.store.name ? v.store.address : null, v.store.area, v.store.customerNumber && `Cliente ${v.store.customerNumber}`].filter(Boolean).join(' · ')}</span>
            <StoreTagsLine tags={storeTags(catalogs.data, v.store)} showMissing={Boolean(catalogs.data?.channels?.length || catalogs.data?.sellers?.length)} />
            {/* The store's page in the directory (its history, data, map); its back link returns here. */}
            {readOnly ? null : <Link to="/stores/$storeId" params={{ storeId: v.store.id }} search={{ from: here }} className={buttonClass('secondary', 'sm', styles.storeLink)}>
              <Store size={16} aria-hidden />Ver ficha del local
            </Link>}
          </div>
          <StatusChip work={v.workStatus} review={v.reviewStatus} />
        </div>
        <dl className={styles.facts}>
          <div><dt>Activador · origen</dt><dd>{v.merchandiserName.split(' ')[0]} · {origin}</dd></div>
          <div><dt>En el local</dt><dd>{v.arrivedAt ? `${formatTime(v.arrivedAt)}${v.finishedAt ? ` a ${formatTime(v.finishedAt)} · ${minutesBetween(v.arrivedAt, v.finishedAt)} min` : ''}` : 'Sin llegada'}</dd></div>
          <div><dt>Autorización</dt><dd>{v.consent ? CONSENT_LABEL[v.consent] : 'Sin marcar'}</dd></div>
        </dl>
        {v.objection ? <Banner tone="warn">“{v.objection}”</Banner> : null}
        {v.task ? <p className={styles.muted}>Tarea: {v.task}</p> : null}
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h3 className={styles.heading}>Fotos</h3>
          <span className={styles.muted}>{v.displays.length ? `${v.displays.length} ${v.displays.length === 1 ? 'exhibición' : 'exhibiciones'} · ${arranged} acomodada${arranged === 1 ? '' : 's'}` : 'Sin exhibiciones'}</span>
        </div>
        <div className={styles.shots}>
          {shots.map(({ p, caption }) => (
            <PhotoThumb key={p.id} photoId={p.id} url={urlFor(p.id)} frame={p} caption={caption} done={p.kind === 'after'} label={`Ver ${caption}`} className={styles.shot}
              onOpen={() => setViewer({ photos: shots.map((s) => s.p), startId: p.id, title: caption })} />
          ))}
          {withoutPhotos.map((d) => (
            <span key={d.id} className={styles.missing}>{displayLabel(d.id)} sin fotos</span>
          ))}
          {!shots.length && !withoutPhotos.length ? <span className={styles.muted}>Sin fotos.</span> : null}
        </div>
      </section>

      <div className={styles.pair}>
        <section className={styles.card}>
          <h3 className={styles.heading}>Trabajo</h3>
          {metrics.length || brands.length ? (
            <dl className={styles.kv}>
              {metrics.map((m) => <div key={m.name}><dt>{m.name}</dt><dd>{m.qty}</dd></div>)}
              {brands.length ? <div><dt>Marcas</dt><dd>{brands.join(', ')}</dd></div> : null}
            </dl>
          ) : (
            <p className={styles.muted}>Sin trabajo cargado.</p>
          )}
        </section>
        <section className={styles.card}>
          <h3 className={styles.heading}>Notas del activador</h3>
          <p className={styles.body}>{v.notes ?? 'Sin notas.'}</p>
          {events.data?.length ? (
            <p className={styles.history}>
              {events.data
                .filter((e) => e.kind === 'work' || e.kind === 'review')
                .map((e) => `${formatTime(e.occurred_at)} ${EVENT_TEXT[e.to_value ?? ''] ?? WORK_STATUS_LABEL[e.to_value as keyof typeof WORK_STATUS_LABEL] ?? ''}`)
                .join(' · ')}
            </p>
          ) : null}
        </section>
      </div>

      {!readOnly && comments.data?.length ? (
        <section className={styles.card}>
          <h3 className={styles.heading}>Conversación</h3>
          <Conversation comments={comments.data} meId={meId} displayLabel={displayLabel} />
        </section>
      ) : null}

      {!readOnly && draft ? <ReviewForm visit={v} meId={meId} draft={draft} displayLabel={displayLabel} /> : null}

      <PhotoViewer
        photos={viewer?.photos ?? []}
        startId={viewer?.startId ?? null}
        title={viewer?.title ?? ''}
        subtitle={v.store.name ?? v.store.address}
        urlFor={urlFor}
        onClose={() => setViewer(null)}
        latest={(id) => v.photos.find((p) => p.id === id)}
        onCrop={readOnly ? undefined : (p, crop) => cropPhoto.mutateAsync({ photoId: p.id, crop })}
      />
    </div>
  )
}

function ReviewForm({ visit: v, meId, draft, displayLabel }: { visit: TeamVisit; meId: string; draft: ReviewDraft; displayLabel: (id: string) => string | undefined }) {
  const blocked = reviewBlock(v, meId)
  if (blocked) return <Banner tone="info">{blocked}</Banner>
  return (
    <section className={styles.card}>
      <TextArea
        label={`Comentario para ${v.merchandiserName.split(' ')[0]}`}
        help="Obligatorio si pedís corrección."
        value={draft.comment}
        onChange={(e) => draft.setComment(e.target.value)}
        maxLength={1000}
        placeholder="Ej.: falta la foto del después de la góndola"
      />
      {v.displays.length ? (
        <Select
          label="Sobre"
          value={draft.displayId ?? ''}
          onChange={(v) => draft.setDisplayId(v || null)}
          options={[{ value: '', label: 'Toda la visita' }, ...v.displays.map((d) => ({ value: d.id, label: displayLabel(d.id) ?? 'Exhibición' }))]}
        />
      ) : null}
    </section>
  )
}

/** Approve (and go to the next one) or ask for a fix; the comment is required for a fix. */
export function ReviewButtons({ visit: v, meId, draft, onDone }: { visit: TeamVisit; meId: string; draft: ReviewDraft; onDone: () => void }) {
  const review = useReview()
  const busy = review.approve.isPending || review.requestFix.isPending
  const error = review.approve.error ?? review.requestFix.error
  if (reviewBlock(v, meId)) return null
  return (
    <div className={styles.buttons}>
      {error ? <Banner tone="error">{error.message}</Banner> : null}
      <div className={styles.buttonRow}>
        <Button
          variant="secondary"
          size="md"
          className={styles.fix}
          disabled={!canRequestFix(draft.comment) || busy}
          loading={review.requestFix.isPending}
          onClick={async () => {
            await review.requestFix.mutateAsync({ visitId: v.id, body: draft.comment, displayId: draft.displayId })
            draft.reset()
            onDone()
          }}
        >
          <MessageSquareWarning size={18} aria-hidden />Pedir corrección
        </Button>
        <Button
          size="md"
          disabled={busy || v.reviewStatus === 'approved'}
          loading={review.approve.isPending}
          onClick={async () => {
            await review.approve.mutateAsync(v.id)
            draft.reset()
            onDone()
          }}
        >
          <Check size={18} aria-hidden />{v.reviewStatus === 'approved' ? 'Aprobada' : 'Aprobar y seguir'}
        </Button>
      </div>
    </div>
  )
}
