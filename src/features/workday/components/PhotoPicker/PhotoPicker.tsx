import { useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { markPicking, pickingDone } from '@/features/workday/photo-picking'
import { CameraSheet } from '@/features/workday/components/CameraSheet'
import styles from './PhotoPicker.module.scss'

const isPhone = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

interface PhotoPickerProps {
  onPick: (file: File) => void
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
  const openPicker = () => {
    markPicking()
    input.current?.click()
  }
  return (
    <>
      <button
        type="button"
        className={clsx(className, dragging && styles.dragging)}
        aria-label={label}
        disabled={disabled}
        onClick={() => (source === 'camera' && isPhone() && hasCamera() ? setCamera(true) : openPicker())}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file?.type.startsWith('image/')) onPick(file)
        }}
      >
        {children}
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
          if (file) onPick(file)
        }}
      />
      {camera ? (
        <CameraSheet
          facing={facing}
          onClose={() => setCamera(false)}
          onShot={(file) => {
            setCamera(false)
            onPick(file)
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
