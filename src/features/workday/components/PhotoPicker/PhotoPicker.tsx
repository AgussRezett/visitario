import { useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import styles from './PhotoPicker.module.scss'

const isPhone = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

interface PhotoPickerProps {
  onPick: (file: File) => void
  /** camera: opens the rear camera on phones; gallery: lets the person choose a picture. */
  source?: 'camera' | 'gallery'
  className?: string
  label?: string
  disabled?: boolean
  children: ReactNode
}

/** Button that takes or picks one photo. On desktop it opens the file picker and accepts a dropped image. */
export function PhotoPicker({ onPick, source = 'camera', className, label, disabled, children }: PhotoPickerProps) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  return (
    <>
      <button
        type="button"
        className={clsx(className, dragging && styles.dragging)}
        aria-label={label}
        disabled={disabled}
        onClick={() => input.current?.click()}
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
        capture={source === 'camera' && isPhone() ? 'environment' : undefined}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onPick(file)
        }}
      />
    </>
  )
}
