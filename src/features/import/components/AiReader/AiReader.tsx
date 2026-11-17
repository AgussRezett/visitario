import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, ImageIcon, Sparkles, X } from 'lucide-react'
import { quotaLeft, quotaText } from '@/domain/ai-quota'
import type { BriefCatalog } from '@/domain/brief'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { TextArea } from '@/ui/TextArea'
import { CaptureError, aiQuotaQuery, useRefreshQuota } from '@/features/import/api/capture'
import { MAX_FILES, isPdf, readFiles, usesFor, type FilesReading } from '@/features/import/api/read-files'
import styles from './AiReader.module.scss'

interface AiReaderProps {
  companyId: string
  catalog: BriefCatalog
  disabled?: boolean
  /** An example of indications, written to whoever reads them. */
  placeholder: string
  /** What was read; returns a line to say back, or throws a CaptureError when nothing is usable. */
  onRead: (reading: FilesReading, names: string[]) => string | null
}

const uses = (n: number) => `${n} ${n === 1 ? 'uso' : 'usos'} de IA`

/** Captures, photos and PDFs with the visits, several at once, and what came written with them: read by AI. */
export function AiReader({ companyId, catalog, disabled, placeholder, onRead }: AiReaderProps) {
  const [files, setFiles] = useState<File[]>([])
  const [text, setText] = useState('')
  const [done, setDone] = useState<number | null>(null)
  const [note, setNote] = useState<{ tone: 'info' | 'error'; text: string } | null>(null)
  const quota = useQuery(aiQuotaQuery(companyId))
  const refreshQuota = useRefreshQuota(companyId)
  const left = quota.data ? quotaLeft(quota.data).left : Infinity
  const need = usesFor(files, text)
  const reading = done !== null
  const full = files.length >= MAX_FILES

  const add = (picked: FileList | null) => {
    const ok = [...(picked ?? [])].filter((f) => isPdf(f) || f.type.startsWith('image/'))
    setFiles((now) => [...now, ...ok.filter((f) => !now.some((n) => n.name === f.name && n.size === f.size))].slice(0, MAX_FILES))
    setNote(ok.length < (picked?.length ?? 0) ? { tone: 'error', text: 'Solo se leen imágenes (capturas, fotos) y PDF.' } : null)
  }

  const read = async () => {
    setNote(null)
    setDone(0)
    try {
      const said = onRead(await readFiles(files, companyId, text, catalog, setDone), files.map((f) => f.name))
      setFiles([])
      setText('')
      if (said) setNote({ tone: 'info', text: said })
    } catch (e) {
      setNote({ tone: 'error', text: e instanceof CaptureError ? e.message : 'No pudimos leer los archivos. Revisá la conexión y probá de nuevo.' })
    } finally {
      setDone(null)
      void refreshQuota()
    }
  }

  return (
    <section className={styles.reader} aria-label="Leer con IA" data-open={files.length ? true : undefined}>
      <label className={styles.pick} data-disabled={disabled || left === 0 || full || undefined}>
        <input
          type="file"
          multiple
          accept="image/*,application/pdf,.pdf"
          className={styles.file}
          disabled={disabled || left === 0 || full || reading}
          aria-label="Elegir archivos"
          onChange={(e) => {
            add(e.target.files)
            e.target.value = ''
          }}
        />
        <span className={styles.icon}><Sparkles size={20} aria-hidden /></span>
        <span className={styles.text}>
          <span className={styles.title}>{files.length ? 'Sumar más archivos' : 'Leer con IA'}<span className={styles.ai}>IA</span></span>
          <span className={styles.help}>
            {full ? `Hasta ${MAX_FILES} archivos por vez.` : 'Capturas, fotos o PDF con las direcciones, como te llegan. Podés elegir varios.'}
          </span>
          {quota.data && !files.length ? <span className={styles.quota} data-closed={left === 0 || undefined}>{quotaText(quota.data)}</span> : null}
        </span>
      </label>

      {files.length ? (
        <div className={styles.body}>
          <ul className={styles.files} aria-label="Archivos elegidos">
            {files.map((f) => (
              <li key={`${f.name}-${f.size}`} className={styles.chosen}>
                {isPdf(f) ? <FileText size={18} aria-hidden /> : <ImageIcon size={18} aria-hidden />}
                <span className={styles.name}>{f.name}</span>
                <button type="button" className={styles.remove} aria-label={`Quitar ${f.name}`} disabled={reading} onClick={() => setFiles((now) => now.filter((n) => n !== f))}>
                  <X size={18} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <TextArea
            label="Indicaciones (opcional)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={1500}
            placeholder={placeholder}
            help="Pegá el mensaje tal cual: de quién es cada local, qué hay que hacer, para qué día."
          />
          <Button size="md" loading={reading} disabled={disabled || need > left} onClick={() => void read()}>
            {reading ? `Leyendo ${Math.min((done ?? 0) + 1, files.length)} de ${files.length}…` : files.length === 1 ? 'Leer el archivo' : `Leer los ${files.length} archivos`}
          </Button>
          <span className={styles.quota} data-closed={need > left || undefined}>
            {need > left ? `Hacen falta ${uses(need)} y te ${left === 1 ? 'queda' : 'quedan'} ${left}. Quitá alguno o pegá el texto.` : `Usa ${uses(need)}.${quota.data ? ` ${quotaText(quota.data)}` : ''}`}
          </span>
        </div>
      ) : null}
      {note ? <Banner tone={note.tone}>{note.text}</Banner> : null}
    </section>
  )
}
