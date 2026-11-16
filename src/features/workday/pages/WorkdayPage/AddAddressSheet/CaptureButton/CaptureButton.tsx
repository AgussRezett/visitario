import { useState } from 'react'
import { ImageUp } from 'lucide-react'
import { transcriptToLines } from '@/domain/capture'
import type { Mentionable } from '@/domain/mentions'
import { Banner } from '@/ui/Banner'
import { CaptureError, readCapture } from '@/features/import/api/capture'
import styles from './CaptureButton.module.scss'

interface CaptureButtonProps {
  companyId: string
  sellers: readonly Mentionable[]
  disabled?: boolean
  /** The stores read, a line each, to check in the list before adding. */
  onRead: (lines: string[]) => void
}

/** Reads a capture of the list (the Excel, the message, an app's card) into the pasted lines. */
export function CaptureButton({ companyId, sellers, disabled, onRead }: CaptureButtonProps) {
  const [reading, setReading] = useState(false)
  const [note, setNote] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)

  const read = async (file: File | undefined) => {
    if (!file) return
    setNote(null)
    setReading(true)
    try {
      const transcript = await readCapture(file, companyId)
      const lines = transcriptToLines(transcript, sellers)
      if (!lines.length) throw new CaptureError('No encontramos direcciones en la captura. Probá con una más nítida, o pegalas.')
      onRead(lines)
      const missed = transcript.unreadable
        ? ` No pudo leer ${transcript.unreadable === 1 ? '1 fila: sumala' : `${transcript.unreadable} filas: sumalas`} a mano.`
        : ''
      setNote({ tone: 'info', text: `Leímos ${lines.length} ${lines.length === 1 ? 'local' : 'locales'}: revisalos contra la captura antes de agregar.${missed}` })
    } catch (e) {
      setNote({ tone: 'error', text: e instanceof CaptureError ? e.message : 'No pudimos leer la captura. Revisá la conexión y probá de nuevo.' })
    } finally {
      setReading(false)
    }
  }

  return (
    <>
      <label className={styles.capture} data-busy={reading || undefined} data-disabled={disabled || undefined}>
        <input
          type="file"
          accept="image/*"
          className={styles.file}
          disabled={disabled || reading}
          aria-label="Leer una captura"
          onChange={(e) => {
            void read(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <span className={styles.icon}><ImageUp size={20} aria-hidden /></span>
        <span className={styles.text}>
          <span className={styles.title}>
            {reading ? 'Leyendo la captura…' : 'Leer una captura'}
            <span className={styles.ai}>IA</span>
          </span>
          <span className={styles.help}>{reading ? 'Tarda unos segundos.' : 'Del Excel o del mensaje: las direcciones aparecen abajo para revisar.'}</span>
        </span>
      </label>
      {note ? <Banner tone={note.tone}>{note.text}</Banner> : null}
    </>
  )
}
