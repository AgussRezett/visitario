import { supabase } from '@/lib/supabase'
import { todayInArgentina } from '@/domain/dates'
import { understandBrief, type BriefCatalog, type UnderstoodBrief } from '@/domain/brief'
import { CaptureError, MESSAGES, errorCode } from './capture'

// Besides the AI's limits, what only a PDF can answer.
const PDF_MESSAGES: Record<string, string> = {
  ...MESSAGES,
  invalid: 'Ese archivo no es un PDF, o pesa más de 10 MB.',
  unreadable: 'No pudimos abrir el PDF. Probá exportarlo de nuevo, o mandá capturas.',
  no_text: 'El PDF no tiene texto para leer (son solo imágenes). Mandá capturas de las direcciones.',
  forbidden: 'Tu usuario no puede leer PDF en esta empresa.',
}
const FAILED = 'No pudimos leer el PDF. Revisá la conexión y probá de nuevo.'

/**
 * The visits of a PDF with written indications: the stores it shows, in its order, with the
 * seller, the task and the day the indications ask for. Checked against the PDF and the lists.
 */
export async function readBrief(file: File, companyId: string, text: string, cat: BriefCatalog): Promise<UnderstoodBrief> {
  if (file.type !== 'application/pdf' || file.size > 10_000_000) throw new CaptureError(PDF_MESSAGES.invalid)
  const today = todayInArgentina()
  const form = new FormData()
  form.append('file', file)
  form.append('company', companyId)
  form.append('text', text.trim())
  form.append('today', today)
  const { data, error } = await supabase.functions.invoke<{ pages?: string[]; brief?: unknown }>('read-brief', { body: form })
  if (error) throw new CaptureError(PDF_MESSAGES[await errorCode(error, PDF_MESSAGES)] ?? FAILED)
  const brief = understandBrief(data?.brief, data?.pages ?? [], cat, today)
  if (!brief.stops.length) throw new CaptureError('No encontramos direcciones en el PDF. Si son solo fotos, mandá capturas de las direcciones.')
  return brief
}
