import type { UnderstoodBrief } from '@/domain/brief'
import type { Mentionable } from '@/domain/mentions'
import { BriefForm } from '@/features/import/components/BriefForm'
import { BriefSummary } from '@/features/import/components/BriefSummary'
import { CaptureButton } from '../CaptureButton'

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

/** Where pasted stores can come from besides typing: a capture, or a PDF with indications (AI). */
export function PasteSources({ companyId, sellers, disabled, day, brief, onLines, onBrief }: PasteSourcesProps) {
  return (
    <>
      <CaptureButton companyId={companyId} sellers={sellers} disabled={disabled} onRead={onLines} />
      <BriefForm
        companyId={companyId}
        catalog={{ sellers, people: [] }}
        disabled={disabled}
        placeholder="Ej.: Mañana hacé estos locales. Todos son de Pablo, menos el de Olaguer que es de Mirko. Avisame si falta algo."
        onRead={onBrief}
      />
      {brief ? <BriefSummary brief={brief} day={day} /> : null}
    </>
  )
}
