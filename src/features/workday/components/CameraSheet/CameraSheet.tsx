import { useEffect, useRef, useState } from 'react'
import { Camera, Focus, RefreshCw, Smartphone, X } from 'lucide-react'
import { Button } from '@/ui/Button'
import { PHOTO_MAX_SIDE, PHOTO_QUALITY } from '@/domain/image'
import { markReady } from '@/features/workday/api/photos'
import { focusPoint, shotSize, type Turn } from './frame'
import { useTurn } from './useMotion'
import styles from './CameraSheet.module.scss'

interface CameraSheetProps {
  /** Rear camera for stores, front camera for a selfie. */
  facing: 'environment' | 'user'
  /** The frame is taken: the camera closes at once, the picture follows (a few ms later). */
  onShot: (photo: Promise<File>) => void
  onClose: () => void
  /** The browser cannot use the camera here: open the phone's camera app instead. */
  onFallback: () => void
}

type State = 'starting' | 'live' | 'blocked'

/** What the browser's camera may let us do: not every phone lets a page choose the focus. */
type FocusCaps = { focusMode?: string[]; pointsOfInterest?: unknown }

/**
 * One canvas for every shot, kept: a new one per photo piled up until the browser collected
 * them, and iPhone has a small budget for canvas memory (photo after photo got slower).
 */
let spare: HTMLCanvasElement | null = null
let encoding = false

/**
 * The frame straight at the kept size (1400 px, JPEG 72 %): drawn once, mirrored for a
 * selfie and turned when the phone is held sideways, and encoded once. Before, the full
 * camera frame was encoded at 92 %, then decoded, shrunk and encoded again.
 */
function snapshot(v: HTMLVideoElement, mirror: boolean, turn: Turn) {
  const size = shotSize(v.videoWidth, v.videoHeight, turn, PHOTO_MAX_SIDE)
  // A shot still encoding keeps its canvas; this one gets its own (rare: two shots at once).
  const canvas = !encoding && spare ? spare : document.createElement('canvas')
  if (!encoding) spare = canvas
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  if (turn === 90) {
    ctx.translate(size.width, 0)
    ctx.rotate(Math.PI / 2)
  } else if (turn === -90) {
    ctx.translate(0, size.height)
    ctx.rotate(-Math.PI / 2)
  }
  if (mirror) {
    ctx.translate(size.draw.width, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(v, 0, 0, size.draw.width, size.draw.height)
  const own = canvas !== spare
  if (!own) encoding = true
  // The frame is in the canvas already: the camera can close while this finishes.
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (own) {
        canvas.width = 0
        canvas.height = 0
      } else encoding = false
      if (!blob) return reject(new Error('encode'))
      const file = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' })
      markReady(file, size.width, size.height)
      resolve(file)
    }, 'image/jpeg', PHOTO_QUALITY)
  })
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
      .getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1600 }, height: { ideal: 1200 } } })
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
    const photo = snapshot(v, facing === 'user', v.videoHeight > v.videoWidth ? turn : 0)
    if (!photo) return setShooting(false)
    // The camera stops now: its stream is the heaviest thing on screen.
    stream.current?.getTracks().forEach((t) => t.stop())
    onShot(photo)
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
