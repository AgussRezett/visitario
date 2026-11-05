import { ArrowLeft, ArrowRight, EyeOff, Undo2 } from 'lucide-react'
import { DATE_AREA, TITLE_AREA, layoutPhotos, type Box } from '@/domain/slides'
import { Button } from '@/ui/Button'
import type { SlidePhoto } from '@/features/team/api/slides'
import styles from './SlidePreview.module.scss'

interface SlidePreviewProps {
  number: number
  title: string
  date: string
  /** In the slide, in their order. */
  photos: SlidePhoto[]
  /** Taken out of this slide by hand. */
  out: SlidePhoto[]
  background: string | null
  urlFor: (id: string) => string | undefined
  selected: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, delta: -1 | 1) => void
  onToggle: (id: string) => void
}

const pct = (b: Box) => ({ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` })

/**
 * One slide as it will come out: the background, the address and day, every photo in
 * place. Tapping a photo lets it move left or right, or leave the slide.
 */
export function SlidePreview({ number, title, date, photos, out, background, urlFor, selected, onSelect, onMove, onToggle }: SlidePreviewProps) {
  const boxes = layoutPhotos(photos.map((p) => p.aspect))
  const at = photos.findIndex((p) => p.id === selected)
  return (
    <figure className={styles.item} aria-label={`Diapositiva ${number}: ${title}`}>
      <div className={styles.slide}>
        {background ? <img className={styles.background} src={background} alt="" /> : null}
        <span className={styles.title} style={pct(TITLE_AREA)}>{title}</span>
        <span className={styles.date} style={pct(DATE_AREA)}>{date}</span>
        {photos.map((p, i) => {
          const box = boxes[i]
          const url = urlFor(p.id)
          return box ? (
            <button key={p.id} type="button" className={styles.photo} style={pct(box)} data-selected={p.id === selected || undefined}
              aria-label={`Foto ${i + 1} de ${photos.length}`} aria-pressed={p.id === selected} onClick={() => onSelect(p.id === selected ? null : p.id)}>
              {url ? <img src={url} alt="" loading="lazy" /> : null}
            </button>
          ) : null
        })}
        {!photos.length ? <span className={styles.none}>Sin fotos: esta diapositiva no sale</span> : null}
      </div>
      {at >= 0 && selected ? (
        <div className={styles.tools} role="toolbar" aria-label="Foto elegida">
          <Button variant="secondary" size="sm" disabled={at === 0} onClick={() => onMove(selected, -1)} aria-label="Mover a la izquierda"><ArrowLeft size={16} aria-hidden /></Button>
          <Button variant="secondary" size="sm" disabled={at === photos.length - 1} onClick={() => onMove(selected, 1)} aria-label="Mover a la derecha"><ArrowRight size={16} aria-hidden /></Button>
          <Button variant="secondary" size="sm" onClick={() => { onToggle(selected); onSelect(null) }}><EyeOff size={16} aria-hidden />Sacar de la diapositiva</Button>
        </div>
      ) : null}
      {out.length ? (
        <div className={styles.out}>
          <span className={styles.outLabel}>Fuera de la diapositiva:</span>
          {out.map((p) => (
            <button key={p.id} type="button" className={styles.outPhoto} onClick={() => onToggle(p.id)} aria-label="Volver a poner esta foto">
              {urlFor(p.id) ? <img src={urlFor(p.id)} alt="" loading="lazy" /> : null}
              <Undo2 size={14} aria-hidden />
            </button>
          ))}
        </div>
      ) : null}
      <figcaption className={styles.caption}>{number}</figcaption>
    </figure>
  )
}
