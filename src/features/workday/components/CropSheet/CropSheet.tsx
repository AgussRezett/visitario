import { useEffect, useRef, useState } from 'react'
import { Crop as CropIcon, RotateCcw } from 'lucide-react'
import { isWhole, moveBy, resizeBy, WHOLE, type Corner, type Crop } from '@/domain/crop'
import { Button } from '@/ui/Button'
import { Sheet } from '@/ui/Sheet'
import type { Framed } from '@/features/workday/components/PhotoImage'
import styles from './CropSheet.module.scss'

interface CropSheetProps {
  open: boolean
  /** The whole photo: the crop is chosen over it. */
  url: string | undefined
  photo: Framed | null
  title: string
  saving?: boolean
  onClose: () => void
  /** null: the whole photo again. */
  onSave: (crop: Crop | null) => void
}

const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se']
const STEP = 0.02 // of the picture, per arrow key

/**
 * Choosing the part of a photo to show: drag the box to move it, its corners to resize it.
 * The file is not touched, so "Ver entera" brings it back whole.
 */
export function CropSheet({ open, url, photo, title, saving, onClose, onSave }: CropSheetProps) {
  const frame = useRef<HTMLDivElement>(null)
  const [crop, setCrop] = useState<Crop>(photo?.crop ?? WHOLE)
  const drag = useRef<{ mode: Corner | 'move'; x: number; y: number; start: Crop } | null>(null)

  useEffect(() => {
    if (open) setCrop(photo?.crop ?? WHOLE)
  }, [open, photo?.crop])

  const aspect = photo?.width && photo.height ? photo.width / photo.height : 4 / 3

  const start = (mode: Corner | 'move') => (e: React.PointerEvent) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { mode, x: e.clientX, y: e.clientY, start: crop }
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    const box = frame.current?.getBoundingClientRect()
    if (!d || !box?.width || !box.height) return
    const dx = (e.clientX - d.x) / box.width
    const dy = (e.clientY - d.y) / box.height
    setCrop(d.mode === 'move' ? moveBy(d.start, dx, dy) : resizeBy(d.start, d.mode, dx, dy))
  }
  const end = () => {
    drag.current = null
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    const delta: Record<string, [number, number]> = { ArrowLeft: [-STEP, 0], ArrowRight: [STEP, 0], ArrowUp: [0, -STEP], ArrowDown: [0, STEP] }
    const d = delta[e.key]
    if (!d) return
    e.preventDefault()
    setCrop((c) => (e.shiftKey ? resizeBy(c, 'se', d[0], d[1]) : moveBy(c, d[0], d[1])))
  }

  const pct = (n: number) => `${n * 100}%`
  const box = { left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }
  return (
    <Sheet open={open} onClose={onClose} title="Recortar foto" subtitle={title}
      footer={<>
        <Button variant="secondary" size="md" disabled={isWhole(crop)} onClick={() => setCrop(WHOLE)}><RotateCcw size={18} aria-hidden />Ver entera</Button>
        <Button size="md" loading={saving} onClick={() => onSave(isWhole(crop) ? null : crop)}><CropIcon size={18} aria-hidden />Guardar recorte</Button>
      </>}>
      <div className={styles.body}>
        <div ref={frame} className={styles.frame} style={{ aspectRatio: String(aspect), width: `min(100% - 44px, calc(52dvh * ${aspect}))` }}
          onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
          <div className={styles.clip} aria-hidden>
            {url ? <img src={url} alt="" draggable={false} className={styles.image} /> : null}
            <span className={styles.shade} style={box} />
          </div>
          <div
            className={styles.box}
            style={box}
            role="group"
            tabIndex={0}
            aria-label="Recorte: arrastralo para moverlo y de las esquinas para cambiar el tamaño. Con las flechas lo movés; con Mayúscula y flechas, el tamaño."
            onPointerDown={start('move')}
            onKeyDown={onKeyDown}
          >
            {CORNERS.map((c) => <span key={c} className={styles[c]} onPointerDown={start(c)} aria-hidden />)}
          </div>
        </div>
        <p className={styles.hint}>Arrastrá el recuadro o sus esquinas. La foto original no se pierde: podés volver a verla entera cuando quieras.</p>
      </div>
    </Sheet>
  )
}
