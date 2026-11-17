import { supabase } from '@/lib/supabase'
import { todayInArgentina } from '@/domain/dates'
import type { Transcript } from '@/domain/capture'
import { briefPages, transcriptText, understandBrief, type BriefCatalog, type Source, type UnderstoodBrief } from '@/domain/brief'
import { CaptureError, MESSAGES, errorCode, readCapture } from './capture'

/** What a set of files gives: transcripts to sort by column, or the stores AI found in them. */
export type FilesReading =
  | { kind: 'captures'; transcripts: Transcript[]; unreadable: number }
  | { kind: 'brief'; brief: UnderstoodBrief; unreadable: number }

export const MAX_FILES = 6
export const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
/** Captures and photos without indications are sorted by column in the app; anything else needs AI to say which stores. */
export const needsBrief = (files: readonly File[], text: string) => !!text.trim() || files.some(isPdf)
/** AI uses a reading takes: one per image, and one to read PDFs and indications. */
export const usesFor = (files: readonly File[], text: string) => files.filter((f) => !isPdf(f)).length + (needsBrief(files, text) ? 1 : 0)

const PDF_MESSAGES: Record<string, string> = {
  ...MESSAGES,
  invalid: 'Ese PDF pesa más de 10 MB.',
  unreadable: 'No pudimos abrir el PDF. Probá exportarlo de nuevo, o mandá capturas.',
  no_text: 'El PDF no tiene texto para leer (son solo imágenes). Mandá capturas de las direcciones.',
  forbidden: 'Tu usuario no puede leer archivos con IA en esta empresa.',
}
const FAILED = 'No pudimos leer los archivos. Revisá la conexión y probá de nuevo.'

async function pdfPages(file: File, companyId: string): Promise<string[]> {
  if (file.size > 10_000_000) throw new CaptureError(PDF_MESSAGES.invalid)
  const form = new FormData()
  form.append('file', new File([file], file.name, { type: 'application/pdf' }))
  form.append('company', companyId)
  const { data, error } = await supabase.functions.invoke<{ pages?: string[] }>('read-brief', { body: form })
  if (error) throw new CaptureError(PDF_MESSAGES[await errorCode(error, PDF_MESSAGES)] ?? FAILED)
  return data?.pages ?? []
}

/**
 * Reads captures, photos and PDFs, with optional written indications. Each file is read on its
 * own (captures transcribed, PDFs' text taken out); then, when there are PDFs or indications,
 * AI says which stores they list and what is asked, checked against the files and the lists.
 */
export async function readFiles(files: readonly File[], companyId: string, text: string, cat: BriefCatalog, onRead?: (done: number) => void): Promise<FilesReading> {
  if (!files.length) throw new CaptureError('Elegí al menos un archivo.')
  if (files.length > MAX_FILES) throw new CaptureError(`Hasta ${MAX_FILES} archivos por vez.`)
  let done = 0
  const sources = await Promise.all(files.map(async (f): Promise<Source & { transcript?: Transcript }> => {
    const named = (e: unknown) => {
      throw e instanceof CaptureError && files.length > 1 ? new CaptureError(`${f.name}: ${e.message}`) : e
    }
    const read = isPdf(f)
      ? await pdfPages(f, companyId).then((pages) => ({ kind: 'pdf' as const, pages }), named)
      : await readCapture(f, companyId).then((t) => ({ kind: 'image' as const, pages: [transcriptText(t)], transcript: t }), named)
    onRead?.(++done)
    return read
  }))
  const transcripts = sources.flatMap((s) => (s.transcript ? [s.transcript] : []))
  const unreadable = transcripts.reduce((n, t) => n + t.unreadable, 0)
  if (!needsBrief(files, text)) return { kind: 'captures', transcripts, unreadable }

  const today = todayInArgentina()
  const pages = briefPages(sources)
  const { data, error } = await supabase.functions.invoke<{ brief?: unknown }>('read-brief', {
    body: { company: companyId, pages, text: text.trim(), today },
  })
  if (error) throw new CaptureError(PDF_MESSAGES[await errorCode(error, PDF_MESSAGES)] ?? FAILED)
  const brief = understandBrief(data?.brief, pages, cat, today)
  if (!brief.stops.length) throw new CaptureError('No encontramos direcciones en los archivos. Si son solo fotos del local, mandá capturas de las direcciones.')
  return { kind: 'brief', brief, unreadable }
}
