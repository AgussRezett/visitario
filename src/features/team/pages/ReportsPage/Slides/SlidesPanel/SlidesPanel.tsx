import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Presentation } from 'lucide-react'
import { dayMonth, deckFileName, slideTitle } from '@/domain/slides'
import type { Range } from '@/domain/report-period'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { MultiSelect } from '@/ui/Select'
import { Skeleton } from '@/ui/Skeleton'
import { companyQuery } from '@/features/admin/api/company'
import { photoFile, slideAssetUrl, slidesQuery, type SlideVisit } from '@/features/team/api/slides'
import { usePhotoUrls } from '@/features/workday/api/photos'
import { personOption } from '@/features/people/person-options'
import { SlidePreview } from '../SlidePreview'
import { buildDeck } from '../build-deck'
import styles from './SlidesPanel.module.scss'

const PAGE = 12
/** Past this many photos, a phone may run out of memory building it. */
const HEAVY = 150

/** Taken out by hand and the order chosen, per visit (until the period changes). */
type Edits = Record<string, { order?: string[]; out?: string[] }>

/**
 * The photo presentation of a period, as the distributor sends it to the brand: a cover
 * with the total of activations (authorized and finished) and one slide per visit with
 * every "después". Looked at and tidied here, then downloaded as PowerPoint.
 */
export function SlidesPanel({ companyId, range, controls }: { companyId: string; range: Range; controls: ReactNode }) {
  const visits = useQuery(slidesQuery(companyId, range))
  const company = useQuery(companyQuery(companyId))
  const [people, setPeople] = useState<string[]>([])
  const [edits, setEdits] = useState<Edits>({})
  const [shown, setShown] = useState(PAGE)
  const [selected, setSelected] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null)

  const all = useMemo(() => visits.data ?? [], [visits.data])
  const chosen = useMemo(() => (people.length ? all.filter((v) => people.includes(v.merchandiserId)) : all), [all, people])
  const merchandisers = useMemo(() => {
    const seen = new Map<string, SlideVisit['merchandiser']>()
    all.forEach((v) => seen.set(v.merchandiserId, v.merchandiser))
    return [...seen].sort((a, b) => a[1].first.localeCompare(b[1].first, 'es')).map(([id, m]) => personOption(id, m.first, m.last))
  }, [all])

  // Each visit's photos as they will go: the order chosen, without the ones taken out.
  const slides = useMemo(() => chosen.map((v) => {
    const e = edits[v.id] ?? {}
    const byId = new Map(v.photos.map((p) => [p.id, p]))
    const order = e.order ?? v.photos.map((p) => p.id)
    return {
      visit: v,
      photos: order.filter((id) => !e.out?.includes(id)).flatMap((id) => byId.get(id) ?? []),
      out: (e.out ?? []).flatMap((id) => byId.get(id) ?? []),
    }
  }), [chosen, edits])
  const withPhotos = slides.filter((s) => s.photos.length)
  const photoCount = withPhotos.reduce((n, s) => n + s.photos.length, 0)
  // Only visits with después show (one taken all out stays, to put them back).
  const previewed = slides.filter((s) => s.photos.length || s.out.length)
  const page = previewed.slice(0, shown)
  const urlFor = usePhotoUrls(page.flatMap((s) => [...s.photos, ...s.out].map((p) => p.id)))
  const pageUrl = slideAssetUrl(company.data?.slidesPagePath ?? null)
  const coverUrl = slideAssetUrl(company.data?.slidesCoverPath ?? null)

  const edit = (visitId: string, change: (e: { order: string[]; out: string[] }) => { order: string[]; out: string[] }) =>
    setEdits((all) => {
      const v = chosen.find((x) => x.id === visitId)
      const current = { order: all[visitId]?.order ?? v?.photos.map((p) => p.id) ?? [], out: all[visitId]?.out ?? [] }
      return { ...all, [visitId]: change(current) }
    })
  const move = (visitId: string, id: string, delta: -1 | 1) => edit(visitId, (e) => {
    const inSlide = e.order.filter((x) => !e.out.includes(x))
    const i = inSlide.indexOf(id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= inSlide.length) return e
    ;[inSlide[i], inSlide[j]] = [inSlide[j] as string, inSlide[i] as string]
    return { order: [...inSlide, ...e.out], out: e.out }
  })
  const toggle = (visitId: string, id: string) => edit(visitId, (e) => ({ order: e.order, out: e.out.includes(id) ? e.out.filter((x) => x !== id) : [...e.out, id] }))

  const generate = async () => {
    setResult(null)
    setProgress({ done: 0, total: photoCount })
    try {
      const { missing } = await buildDeck({
        total: chosen.length,
        slides: withPhotos.map((s) => ({ title: slideTitle(s.visit.address, s.visit.customerNumber), date: dayMonth(s.visit.date), photoIds: s.photos.map((p) => p.id) })),
        coverUrl, pageUrl, fileName: deckFileName(range.from, range.to),
      }, photoFile, (done, total) => setProgress({ done, total }))
      setResult(missing
        ? { tone: 'warn', text: `Listo, pero ${missing === 1 ? '1 foto no se pudo bajar y quedó afuera' : `${missing} fotos no se pudieron bajar y quedaron afuera`}. Probá de nuevo con buena conexión.` }
        : { tone: 'ok', text: 'Listo: la presentación se descargó. Abrila con PowerPoint o subila a Google Slides.' })
    } catch {
      setResult({ tone: 'error', text: 'No pudimos armar la presentación. Revisá la conexión y probá de nuevo.' })
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.bar}>
        {controls}
        {merchandisers.length > 1 ? (
          <MultiSelect label="Activador" hideLabel size="sm" values={people} onChange={setPeople} allLabel="Todo el equipo" noun="activadores" options={merchandisers} />
        ) : null}
      </div>

      {visits.isError ? <Banner tone="error">No pudimos cargar las visitas. Revisá la conexión y recargá.</Banner> : null}
      {visits.isPending ? <Skeleton height={220} /> : (
        <section className={styles.summary} aria-label="La presentación">
          <div className={styles.figures}>
            <span className={styles.figure}><b>{chosen.length}</b>{chosen.length === 1 ? 'activación autorizada y terminada' : 'activaciones autorizadas y terminadas'}</span>
            <span className={styles.figure}><b>{withPhotos.length + 1}</b>diapositivas con la portada</span>
            <span className={styles.figure}><b>{photoCount}</b>{photoCount === 1 ? 'foto del después' : 'fotos del después'}</span>
          </div>
          {chosen.length > withPhotos.length ? <p className={styles.help}>{chosen.length - withPhotos.length === 1 ? '1 activación no tiene fotos del después: cuenta en el total pero no lleva diapositiva.' : `${chosen.length - withPhotos.length} activaciones no tienen fotos del después: cuentan en el total pero no llevan diapositiva.`}</p> : null}
          {!coverUrl || !pageUrl ? <p className={styles.help}>Sin fondos cargados, sale en blanco. El admin los sube en Empresa → Presentación de fotos.</p> : null}
          {photoCount > HEAVY ? <p className={styles.help}>Son muchas fotos: armala desde la compu, el celu puede quedarse sin memoria.</p> : null}
          <div className={styles.actions}>
            <Button onClick={() => void generate()} disabled={!withPhotos.length || Boolean(progress)} loading={Boolean(progress)}>
              <Presentation size={20} aria-hidden />Descargar PowerPoint
            </Button>
            {progress ? (
              <span className={styles.progress} role="status">
                <progress max={progress.total || 1} value={progress.done} aria-label="Fotos listas" />
                {progress.done < progress.total ? `Preparando fotos: ${progress.done} de ${progress.total}` : 'Armando el archivo…'}
              </span>
            ) : null}
          </div>
          {result ? <Banner tone={result.tone}>{result.text}</Banner> : null}
        </section>
      )}

      {previewed.length ? (
        <section className={styles.previews} aria-label="Vista previa">
          <p className={styles.help}>Tocá una foto para moverla o sacarla de su diapositiva.</p>
          <div className={styles.grid}>
            {page.map((s, i) => (
              <SlidePreview key={s.visit.id} number={i + 2} title={slideTitle(s.visit.address, s.visit.customerNumber)} date={dayMonth(s.visit.date)}
                photos={s.photos} out={s.out} background={pageUrl} urlFor={urlFor} selected={selected} onSelect={setSelected}
                onMove={(id, d) => move(s.visit.id, id, d)} onToggle={(id) => toggle(s.visit.id, id)} />
            ))}
          </div>
          {shown < previewed.length ? <Button variant="secondary" onClick={() => setShown((n) => n + PAGE)}>Ver más ({previewed.length - shown})</Button> : null}
        </section>
      ) : !visits.isPending && !visits.isError ? (
        <Banner tone="info" title={chosen.length ? 'Ninguna activación tiene fotos del después' : 'No hay activaciones en este período'}>Elegí otro período: entran las visitas autorizadas y terminadas con fotos del después.</Banner>
      ) : null}
    </div>
  )
}
