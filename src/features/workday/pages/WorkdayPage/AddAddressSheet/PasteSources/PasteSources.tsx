import { transcriptToLines } from '@/domain/capture'
import type { UnderstoodBrief } from '@/domain/brief'
import type { Mentionable } from '@/domain/mentions'
import { CaptureError } from '@/features/import/api/capture'
import { AiReader } from '@/features/import/components/AiReader'
import { BriefSummary } from '@/features/import/components/BriefSummary'
import { readNote } from '@/features/import/read-note'

interface PasteSourcesProps {
  companyId: string
  sellers: readonly Mentionable[]
  disabled: boolean
  /** The day being filled. */
  day: string
  brief: UnderstoodBrief | null
  onLines: (lines: string[]) => void
  onBrief: (brief: UnderstoodBrief) => void
}

/** Stores from files, read by AI: captures go in as lines to check; PDFs or indications, with what was understood. */
export function PasteSources({ companyId, sellers, disabled, day, brief, onLines, onBrief }: PasteSourcesProps) {
  return (
    <>
      <AiReader
        companyId={companyId}
        catalog={{ sellers, people: [] }}
        disabled={disabled}
        placeholder="Ej.: Mañana hacé estos locales. Todos son de Pablo, menos el de Olaguer que es de Mirko. Avisame si falta algo."
        onRead={(r) => {
          if (r.kind === 'brief') {
            onBrief(r.brief)
            return r.unreadable ? readNote(r.brief.stops.length, r.unreadable) : null
          }
          const lines = r.transcripts.flatMap((t) => transcriptToLines(t, sellers))
          if (!lines.length) throw new CaptureError('No encontramos direcciones. Probá con capturas más nítidas, o pegalas.')
          onLines(lines)
          return readNote(lines.length, r.unreadable)
        }}
      />
      {brief ? <BriefSummary brief={brief} day={day} /> : null}
    </>
  )
}
