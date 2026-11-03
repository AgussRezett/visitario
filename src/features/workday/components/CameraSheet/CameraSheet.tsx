import { useEffect, useRef, useState } from 'react'
import { Camera, Focus, RefreshCw, Smartphone, X } from 'lucide-react'
import { Button } from '@/ui/Button'
import { focusPoint, turnedSize, type Turn } from './frame'
import { useTurn } from './useMotion'
import styles from './CameraSheet.module.scss'

interface CameraSheetProps {
  /** Rear camera for stores, front camera for a selfie. */
  facing: 'environment' | 'user'
  onShot: (file: File) => void
  onClose: () => void
  /** The browser cannot use the camera here: open the phone's camera app instead. */
  onFallback: () => void
}

type State = 'starting' | 'live' | 'blocked'

/** What the browser's camera may let us do: not every phone lets a page choose the focus. */
type FocusCaps = { focusMode?: string[]; pointsOfInterest?: unknown }

/** A canvas holds its pixels until the browser collects it; iPhone has a small budget for them. */
const release = (c: HTMLCanvasElement) => {
  c.width = 0
  c.height = 0
}

/** The frame as it is saved: mirrored for a selfie, turned when the phone is held sideways. */
function capture(v: HTMLVideoElement, mirror: boolean, turn: Turn) {
  const frame = document.createElement('canvas')
  frame.width = v.videoWidth
  frame.height = v.videoHeight
  const fctx = frame.getContext('2d')
  if (!fctx) return null
  if (mirror) {
    fctx.translate(frame.width, 0)
    fctx.scale(-1, 1)
  }
  fctx.drawImage(v, 0, 0)
  if (turn === 0) return frame
  const out = document.createElement('canvas')
  Object.assign(out, turnedSize(frame.width, frame.height, turn))
  const octx = out.getContext('2d')
  if (!octx) return frame
  if (turn === 90) octx.translate(out.width, 0)
  else octx.translate(0, out.height)
  octx.rotate((turn * Math.PI) / 180)
  octx.drawImage(frame, 0, 0)
  release(frame)
  return out
}

/**
 * The camera inside Visitario. Opening the phone's camera app can make Android close the
 * browser to free memory, and the photo is lost on the way back; here the app stays open.
 * The picture is drawn on a canvas, so it carries no location.
 */
export function CameraSheet({ facing: initial, onShot, onClose, onFallback }: CameraSheetProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState(initial)
  const [state, setState] = useState<State>('starting')
  const [canSwitch, setCanSwitch] = useState(false)
  const [shooting, setShooting] = useState(false)
  const [canFocus, setCanFocus] = useState(false)
  const [ring, setRing] = useState<{ x: number; y: number; at: number } | null>(null)
  const turn = useTurn()

  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal?.()
  }, [])

  useEffect(() => {
    let alive = true
    const el = video.current
    setState('starting')
    navigator.mediaDevices
      .getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } } })
      .then(async (s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop())
        stream.current = s
        // Focus by itself where the phone lets the page ask for it; a tap picks the point.
        const track = s.getVideoTracks()[0]
        const caps = (track?.getCapabilities?.() ?? {}) as FocusCaps
        if (caps.focusMode?.includes('continuous')) void track?.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => null)
        setCanFocus(Boolean(caps.pointsOfInterest) || Boolean(caps.focusMode?.includes('single-shot')))
        if (video.current) {
          video.current.srcObject = s
          await video.current.play().catch(() => null)
        }
        setState('live')
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [])
        if (alive) setCanSwitch(devices.filter((d) => d.kind === 'videoinput').length > 1)
      })
      .catch(() => alive && setState('blocked'))
    return () => {
      alive = false
      stream.current?.getTracks().forEach((t) => t.stop())
      stream.current = null
      if (el) el.srcObject = null
    }
  }, [facing])

  const shoot = () => {
    const v = video.current
    if (!v || !v.videoWidth || shooting) return
    setShooting(true)
    // Only a standing picture is turned: if the stream already lies down, it is right as it is.
    const canvas = capture(v, facing === 'user', v.videoHeight > v.videoWidth ? turn : 0)
    if (!canvas) return setShooting(false)
    canvas.toBlob(
      (blob) => {
        release(canvas)
        setShooting(false)
        if (blob) onShot(new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.92,
    )
  }

  /** Tap to focus there (where the phone allows it). */
  const focusAt = (e: React.PointerEvent<HTMLVideoElement>) => {
    const v = video.current
    const track = stream.current?.getVideoTracks()[0]
    if (!v || !track || !canFocus || !v.videoWidth) return
    const box = v.getBoundingClientRect()
    const tap = { x: e.clientX - box.left, y: e.clientY - box.top }
    const point = focusPoint(tap, box, { width: v.videoWidth, height: v.videoHeight })
    setRing({ ...tap, at: Date.now() })
    void track.applyConstraints({ advanced: [{ pointsOfInterest: [point], focusMode: 'single-shot' } as MediaTrackConstraintSet] }).catch(() => null)
  }

  return (
    <dialog ref={dialog} className={styles.camera} aria-label="Cámara" onClose={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.view}>
        <video ref={video} className={styles.video} data-mirror={facing === 'user' || undefined} playsInline muted autoPlay onPointerUp={focusAt} />
        {state === 'live' && !canFocus ? (
          // This browser does not let the page focus: the phone's own camera does.
          <button type="button" className={styles.native} onClick={onFallback}>
            <Smartphone size={16} aria-hidden />Cámara del celular
          </button>
        ) : null}
        {ring ? <span key={ring.at} className={styles.ring} style={{ left: ring.x, top: ring.y }} aria-hidden /> : null}
        {state === 'live' && (turn || canFocus) ? (
          <p className={styles.tip} data-turn={turn || undefined}>
            {turn ? 'Foto horizontal' : canFocus ? <><Focus size={14} aria-hidden />Tocá para enfocar</> : null}
          </p>
        ) : null}
      </div>
      {state === 'starting' ? <p className={styles.status} role="status">Abriendo la cámara…</p> : null}
      {state === 'blocked' ? (
        <div className={styles.blocked} role="alert">
          <p className={styles.blockedTitle}>No pudimos abrir la cámara acá</p>
          <p className={styles.blockedText}>Puede que el navegador no tenga permiso. Abrí la cámara del celular o habilitá el permiso de cámara para Visitario.</p>
          <Button size="lg" onClick={onFallback}><Camera size={20} aria-hidden />Abrir la cámara del celular</Button>
        </div>
      ) : null}
      <div className={styles.bar}>
        <button type="button" className={styles.round} onClick={onClose} aria-label="Cerrar la cámara">
          <X size={24} aria-hidden />
        </button>
        <button type="button" className={styles.shutter} data-turn={turn || undefined} onClick={shoot} disabled={state !== 'live' || shooting} aria-label="Sacar la foto">
          <span className={styles.shutterInner} />
        </button>
        {canSwitch ? (
          <button type="button" className={styles.round} onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))} aria-label="Cambiar de cámara">
            <RefreshCw size={22} aria-hidden />
          </button>
        ) : <span className={styles.spacer} aria-hidden />}
      </div>
    </dialog>
  )
}
