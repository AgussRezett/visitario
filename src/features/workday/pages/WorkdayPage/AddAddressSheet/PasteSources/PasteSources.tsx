import { rowsFromTranscript, type ReviewRow } from '@/domain/add-review'
import type { UnderstoodBrief } from '@/domain/brief'
import type { Mentionable } from '@/domain/mentions'
import { CaptureError } from '@/features/import/api/capture'
import { AiReader } from '@/features/import/components/AiReader'
import { readNote } from '@/features/import/read-note'

interface PasteSourcesProps {
  companyId: string
  sellers: readonly Mentionable[]
  channels: readonly Mentionable[]
  disabled: boolean
  /** A capture's stores, to review row by row. */
  onRows: (rows: ReviewRow[], note: string) => void
  /** A PDF or indications understood: its stores and tasks, and what to say of the reading. */
  onBrief: (brief: UnderstoodBrief, note: string | null) => void
}

/** Stores from files, read by AI: captures go to the review row by row; PDFs or indications, as lines with what was understood. */
export function PasteSources({ companyId, sellers, channels, disabled, onRows, onBrief }: PasteSourcesProps) {
  return (
    <>
      <AiReader
        companyId={companyId}
        catalog={{ sellers, people: [] }}
        disabled={disabled}
        placeholder="Ej.: Mañana hacé estos locales. Todos son de Pablo, menos el de Olaguer que es de Mirko. Avisame si falta algo."
        onRead={(r) => {
          if (r.kind === 'brief') {
            const note = r.unreadable ? readNote(r.brief.stops.length, r.unreadable) : null
            onBrief(r.brief, note)
            return note
          }
          const read = Date.now()
          const rows = r.transcripts.flatMap((t, i) => rowsFromTranscript(t, sellers, channels, `capture-${read}-${i}`))
          if (!rows.length) throw new CaptureError('No encontramos direcciones. Probá con capturas más nítidas, o pegalas.')
          const note = readNote(rows.length, r.unreadable)
          onRows(rows, note)
          return note
        }}
      />
    </>
  )
}
