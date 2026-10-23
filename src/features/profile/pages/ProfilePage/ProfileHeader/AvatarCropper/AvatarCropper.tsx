import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, ImagePlus, ZoomIn, ZoomOut } from 'lucide-react'
import { clampFraming, framedSquare, MAX_ZOOM, MIN_ZOOM, type Framing } from '@/domain/profile'
import { Button } from '@/ui/Button'
import type { Square } from '@/features/profile/api'
import styles from './AvatarCropper.module.scss'

interface AvatarCropperProps {
  file: File
  onConfirm: (square: Square) => void
  onChooseAnother: () => void
}

const START: Framing = { zoom: 1, x: 0, y: 0 }
const STEP = 24 // px per arrow key

/**
 * Framing the new photo in the round avatar: drag to move, pinch (or the wheel, or the
 * slider) to zoom. The picture always covers the circle. Only the framed square is kept.
 */
export function AvatarCropper({ file, onConfirm, onChooseAnother }: AvatarCropperProps) {
  const frame = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [view, setView] = useState(280)
  const [f, setF] = useState<Framing>(START)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number; zoom: number } | null>(null)

  useEffect(() => {
    const next = URL.createObjectURL(file)
    setUrl(next)
    setSize(null)
    setF(START)
    return () => URL.revokeObjectURL(next)
  }, [file])
  useLayoutEffect(() => {
    const w = frame.current?.getBoundingClientRect().width
    if (w) setView(w)
  }, [url])

  const set = (next: Framing) => size && setF(clampFraming(next, size.w, size.h, view))
  // The wheel zooms instead of scrolling the sheet: a listener that can stop the scroll.
  const wheel = useRef<(e: WheelEvent) => void>(() => undefined)
  wheel.current = (e: WheelEvent) => {
    e.preventDefault()
    set({ ...f, zoom: f.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08) })
  }
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const listener = (e: WheelEvent) => wheel.current(e)
    el.addEventListener('wheel', listener, { passive: false })
    return () => el.removeEventListener('wheel', listener)
  }, [])
  const scale = size ? (view / Math.min(size.w, size.h)) * f.zoom : 1

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      if (a && b) pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: f.zoom }
    }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const last = pointers.current.get(e.pointerId)
    if (!last) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      if (a && b) set({ ...f, zoom: pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.distance) })
      return
    }
    set({ ...f, x: f.x + e.clientX - last.x, y: f.y + e.clientY - last.y })
  }
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    const moves: Record<string, Partial<Framing>> = {
      ArrowLeft: { x: f.x + STEP }, ArrowRight: { x: f.x - STEP }, ArrowUp: { y: f.y + STEP }, ArrowDown: { y: f.y - STEP },
      '+': { zoom: f.zoom + 0.2 }, '=': { zoom: f.zoom + 0.2 }, '-': { zoom: f.zoom - 0.2 },
    }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    set({ ...f, ...move })
  }

  return (
    <div className={styles.cropper}>
      <div
        ref={frame}
        className={styles.frame}
        tabIndex={0}
        role="group"
        aria-label="Encuadre de la foto. Arrastrá para moverla; con las flechas también, y con + y − la acercás."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        {url ? (
          <img
            src={url}
            alt=""
            draggable={false}
            className={styles.image}
            onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            style={size ? { width: size.w * scale, height: size.h * scale, transform: `translate(-50%, -50%) translate(${f.x}px, ${f.y}px)` } : { opacity: 0 }}
          />
        ) : null}
        <span className={styles.mask} aria-hidden />
      </div>
      <p className={styles.hint}>Arrastrá para moverla y pellizcá para acercarla.</p>

      <div className={styles.zoom}>
        <ZoomOut size={18} aria-hidden />
        <input
          type="range"
          className={styles.slider}
          aria-label="Acercar"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={f.zoom}
          onChange={(e) => set({ ...f, zoom: Number(e.target.value) })}
        />
        <ZoomIn size={18} aria-hidden />
      </div>

      <div className={styles.buttons}>
        <Button size="lg" disabled={!size} onClick={() => size && onConfirm(framedSquare(f, size.w, size.h, view))}>
          <Check size={20} aria-hidden />Usar esta foto
        </Button>
        <Button size="md" variant="secondary" onClick={onChooseAnother}>
          <ImagePlus size={18} aria-hidden />Elegir otra
        </Button>
      </div>
    </div>
  )
}
