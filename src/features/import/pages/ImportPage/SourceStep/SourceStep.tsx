import { useState } from 'react'
import { FileSpreadsheet, ImageUp, Upload } from 'lucide-react'
import { parsePasted } from '@/domain/import'
import { formatDayMonth, todayInArgentina } from '@/domain/dates'
import { Banner } from '@/ui/Banner'
import { Button } from '@/ui/Button'
import type { Mentionable } from '@/domain/mentions'
import { MentionTextArea } from '@/features/workday/components/MentionTextArea'
import { FileError, readSpreadsheet } from '@/features/import/api/read-file'
import type { SavedFormat } from '@/features/import/api/import'
import { CaptureError, readCapture } from '@/features/import/api/capture'
import { withCapture, withSheets, type Draft } from '@/features/import/draft'
import { StepFrame } from '../StepFrame'
import styles from './SourceStep.module.scss'

interface SourceStepProps {
  companyId: string
  /** Offered with @ and # in the pasted text. */
  tags: { sellers: readonly Mentionable[]; channels: readonly Mentionable[] }
  /** Admins add a seller from the @ list. */
  onAddSeller?: (name: string) => Promise<Mentionable>
  draft: Draft
  formats: SavedFormat[]
  onCancel: () => void
  /** The draft is ready: go to the columns, or straight to the review when nothing needs mapping. */
  onRead: (d: Draft, next: 2 | 3) => void
}

/** Step 1: a spreadsheet file or pasted text. */
export function SourceStep({ companyId, tags, onAddSeller, draft, formats, onCancel, onRead }: SourceStepProps) {
  const [pasted, setPasted] = useState('')
  const [reading, setReading] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setReading(true)
    try {
      const sheets = await readSpreadsheet(file)
      if (!sheets.length) throw new FileError('La planilla está vacía.')
      const first = Math.max(0, sheets.findIndex((s) => s.table.length > 1))
      const d = withSheets(draft, file.name, sheets, first, formats)
      onRead(d, d.format ? 3 : 2)
    } catch (e) {
      setError(e instanceof FileError ? e.message : 'No pudimos leer el archivo.')
    } finally {
      setReading(false)
    }
  }

  /** A capture or photo of the list, read by AI: straight to the review. */
  const openCapture = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setCapturing(true)
    try {
      const { rows, unreadable } = await readCapture(file, companyId)
      const d = withCapture(draft, file.name, rows, unreadable)
      if ((d.sheets[0]?.table.length ?? 0) < 2) throw new CaptureError('No encontramos locales en la captura. Probá con una más nítida, o pegá el texto.')
      onRead(d, 3)
    } catch (e) {
      setError(e instanceof CaptureError ? e.message : 'No pudimos leer la captura. Revisá la conexión y probá de nuevo.')
    } finally {
      setCapturing(false)
    }
  }

  const usePasted = () => {
    const read = parsePasted(pasted)
    if (read.kind === 'lines') onRead({ ...draft, fileName: null, sheets: [], lines: read.lines, format: null, edits: {}, skipped: [], capture: null }, 3)
    else {
      const d = withSheets(draft, null, [{ name: 'Texto pegado', table: read.table }], 0, formats)
      onRead(d, d.format ? 3 : 2)
    }
  }
  const pastedLines = pasted.split('\n').filter((l) => l.trim()).length

  return (
    <StepFrame
      step={1}
      kind="Importar"
      title="¿De dónde salen los locales?"
      onBack={onCancel}
      backLabel="Asignar jornadas"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onCancel} className={styles.cancel}>Cancelar</Button>
          <Button size="md" disabled={!pastedLines} onClick={usePasted}>Continuar con el texto</Button>
        </>
      }
    >
      <div className={styles.options}>
        <label className={styles.drop} data-busy={reading || undefined}>
          <input type="file" accept=".xlsx,.csv,.txt,text/csv" className={styles.file} onChange={(e) => void open(e.target.files?.[0])} disabled={reading} aria-label="Subir planilla" />
          <span className={styles.dropIcon}><Upload size={22} aria-hidden /></span>
          <span className={styles.dropTitle}>{reading ? 'Leyendo la planilla…' : 'Subir Excel o CSV'}</span>
          <span className={styles.dropHelp}>La planilla de ruteo como te llega: elegís qué hay en cada columna en el paso siguiente.</span>
        </label>

        <label className={styles.drop} data-busy={capturing || undefined}>
          <input type="file" accept="image/*" className={styles.file} onChange={(e) => void openCapture(e.target.files?.[0])} disabled={capturing || reading} aria-label="Subir captura" />
          <span className={styles.dropIcon}><ImageUp size={22} aria-hidden /></span>
          <span className={styles.dropTitle}>{capturing ? 'Leyendo la captura…' : 'Desde una captura'}<span className={styles.ai}>IA</span></span>
          <span className={styles.dropHelp}>{capturing ? 'La IA está leyendo las direcciones. Tarda unos segundos.' : 'Subí la foto o captura de tu Excel o del mensaje, y la IA lee las direcciones.'}</span>
        </label>

        <div className={styles.paste}>
          <MentionTextArea
            label="O pegá el texto"
            value={pasted}
            onChange={setPasted}
            sellers={tags.sellers}
            channels={tags.channels}
            onAddSeller={onAddSeller}
            rows={7}
            placeholder={`Un local por línea. Nro. de cliente y zona, si los tenés:\n12345; Tres Arroyos 762; Paternal${tags.sellers.length || onAddSeller ? ' @vendedor' : ''}\nAmenábar 1260`}
            help={
              pastedLines
                ? `${pastedLines} ${pastedLines === 1 ? 'línea' : 'líneas'}`
                : `Separá con ; o coma, en cualquier orden.${tags.sellers.length || tags.channels.length ? ' Con @ elegís el vendedor y con # el canal.' : ''} Si copiás del Excel con títulos o más columnas, te pregunta qué es cada una.`
            }
          />
        </div>
      </div>

      {error ? <Banner tone="error">{error}</Banner> : null}

      {formats.length ? (
        <section className={styles.formats} aria-label="Formatos guardados">
          <span className={styles.eyebrow}>Formatos guardados</span>
          {formats.map((f) => (
            <span key={f.id} className={styles.format}>
              <FileSpreadsheet size={16} aria-hidden />
              <span className={styles.formatName}>{f.name}</span>
              {f.lastUsedAt ? <span className={styles.formatMeta}>usado el {formatDayMonth(todayInArgentina(new Date(f.lastUsedAt)))}</span> : null}
            </span>
          ))}
          <p className={styles.help}>Una planilla con las mismas columnas se reconoce sola y pasa directo a la revisión.</p>
        </section>
      ) : null}
    </StepFrame>
  )
}
