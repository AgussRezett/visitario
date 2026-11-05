import { useRef, useState, type ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import clsx from 'clsx'
import { markPicking, pickingDone } from '@/features/workday/photo-picking'
import { CameraSheet } from '@/features/workday/components/CameraSheet'
import { askMotion } from '@/features/workday/components/CameraSheet/useMotion'
import styles from './PhotoPicker.module.scss'

const isPhone = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

interface PhotoPickerProps {
  /** May return a promise: the button shows the photo is on its way until it settles. */
  onPick: (file: File) => unknown
  /** camera: opens the rear camera on phones; gallery: lets the person choose a picture. */
  source?: 'camera' | 'gallery'
  /** Which camera opens on phones: the rear one (stores) or the front one (a selfie). */
  facing?: 'environment' | 'user'
  className?: string
  label?: string
  disabled?: boolean
  children: ReactNode
}

const hasCamera = () => typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'

/**
 * Button that takes or picks one photo. On phones the camera opens inside Visitario (the
 * phone's camera app can make Android close the browser); the gallery and the desktop use
 * the file picker, which also accepts a dropped image.
 */
export function PhotoPicker({ onPick, source = 'camera', facing = 'environment', className, label, disabled, children }: PhotoPickerProps) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [camera, setCamera] = useState(false)
  // From the shutter (or the chosen file) until the photo is in the visit: "Guardando foto".
  const [pending, setPending] = useState(0)
  const track = (work: Promise<unknown>) => {
    setPending((n) => n + 1)
    void work.catch(() => null).finally(() => setPending((n) => Math.max(0, n - 1)))
  }
  const pick = (file: File) => track(Promise.resolve().then(() => onPick(file)))
  const openPicker = () => {
    markPicking()
    input.current?.click()
  }
  return (
    <>
      <button
        type="button"
        className={clsx(className, styles.picker, dragging && styles.dragging)}
        aria-label={label}
        aria-busy={pending > 0 || undefined}
        disabled={disabled}
        onClick={() => {
          if (source === 'camera' && isPhone() && hasCamera()) {
            askMotion() // iPhone: to save sideways photos lying down
            setCamera(true)
          } else openPicker()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file?.type.startsWith('image/')) pick(file)
        }}
      >
        {children}
        {pending ? (
          <span className={styles.busy} role="status">
            <LoaderCircle size={22} aria-hidden className={styles.spin} />
            <span className={styles.busyText}>Guardando foto</span>
          </span>
        ) : null}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        capture={source === 'camera' && isPhone() ? facing : undefined}
        onChange={(e) => {
          pickingDone()
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) pick(file)
        }}
      />
      {camera ? (
        <CameraSheet
          facing={facing}
          onClose={() => setCamera(false)}
          onShot={(photo) => {
            setCamera(false)
            // Encoding takes a moment after the camera is gone; a failure is rare (no canvas).
            track(photo.then(onPick))
          }}
          onFallback={() => {
            setCamera(false)
            openPicker()
          }}
        />
      ) : null}
    </>
  )
}
