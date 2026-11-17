import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, X } from 'lucide-react'
import { quotaLeft } from '@/domain/ai-quota'
import type { BriefCatalog, UnderstoodBrief } from '@/domain/brief'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import { TextArea } from '@/ui/TextArea'
import { CaptureError, aiQuotaQuery, useRefreshQuota } from '@/features/import/api/capture'
import { readBrief } from '@/features/import/api/brief'
import styles from './BriefForm.module.scss'

interface BriefFormProps {
  companyId: string
  catalog: BriefCatalog
  disabled?: boolean
  /** Who the indications are written to: the merchandiser ("te") or the supervisor. */
  placeholder: string
  onRead: (brief: UnderstoodBrief, fileName: string) => void
}

/** A PDF with the day's stores and the indications that came with it, read by AI. */
export function BriefForm({ companyId, catalog, disabled, placeholder, onRead }: BriefFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const quota = useQuery(aiQuotaQuery(companyId))
  const refreshQuota = useRefreshQuota(companyId)
  const closed = quota.data ? quotaLeft(quota.data).left === 0 : false

  const read = async () => {
    if (!file) return
    setError(null)
    setReading(true)
    try {
      onRead(await readBrief(file, companyId, text, catalog), file.name)
    } catch (e) {
      setError(e instanceof CaptureError ? e.message : 'No pudimos leer el PDF. Revisá la conexión y probá de nuevo.')
    } finally {
      setReading(false)
      void refreshQuota()
    }
  }

  return (
    <section className={styles.brief} aria-label="PDF con indicaciones" data-open={file ? true : undefined}>
      <label className={styles.pick} data-disabled={disabled || closed || undefined}>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className={styles.file}
          disabled={disabled || closed || reading}
          aria-label="Elegir el PDF"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null)
            setError(null)
            e.target.value = ''
          }}
        />
        <span className={styles.icon}><FileText size={20} aria-hidden /></span>
        <span className={styles.text}>
          <span className={styles.title}>{file ? file.name : 'Desde un PDF con indicaciones'}<span className={styles.ai}>IA</span></span>
          <span className={styles.help}>
            {file ? 'Tocá para elegir otro.' : 'El PDF de locales como te llega, y lo que te escribieron: arma el día en el orden del PDF.'}
          </span>
        </span>
      </label>
      {file ? (
        <button type="button" className={styles.clear} aria-label="Quitar el PDF" onClick={() => setFile(null)} disabled={reading}>
          <X size={18} aria-hidden />
        </button>
      ) : null}

      {file ? (
        <div className={styles.body}>
          <TextArea
            label="Indicaciones"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={1500}
            placeholder={placeholder}
            help="Pegá el mensaje tal cual: de quién es cada local, qué hay que hacer, para qué día."
          />
          <Button size="md" loading={reading} disabled={disabled || closed} onClick={() => void read()}>
            {reading ? 'Leyendo el PDF…' : 'Leer el PDF'}
          </Button>
          {reading ? <p className={styles.help}>La IA está leyendo las páginas y las indicaciones. Tarda unos segundos.</p> : null}
        </div>
      ) : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
    </section>
  )
}
