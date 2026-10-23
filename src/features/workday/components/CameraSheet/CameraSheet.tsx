import { useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, X } from 'lucide-react'
import { Button } from '@/ui/Button'
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

  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal?.()
  }, [])

  useEffect(() => {
    let alive = true
    setState('starting')
    navigator.mediaDevices
      .getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } } })
      .then(async (s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop())
        stream.current = s
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
    }
  }, [facing])

  const shoot = () => {
    const v = video.current
    if (!v || !v.videoWidth || shooting) return
    setShooting(true)
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return setShooting(false)
    if (facing === 'user') {
      // A selfie is saved as people see themselves in the preview.
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(v, 0, 0)
    canvas.toBlob(
      (blob) => {
        setShooting(false)
        if (blob) onShot(new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.92,
    )
  }

  return (
    <dialog ref={dialog} className={styles.camera} aria-label="Cámara" onClose={(e) => e.target === e.currentTarget && onClose()}>
      <video ref={video} className={styles.video} data-mirror={facing === 'user' || undefined} playsInline muted autoPlay />
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
        <button type="button" className={styles.shutter} onClick={shoot} disabled={state !== 'live' || shooting} aria-label="Sacar la foto">
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
