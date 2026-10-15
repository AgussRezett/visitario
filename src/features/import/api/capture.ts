import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { CaptureRow } from '@/domain/capture'
import { compressPhoto } from '@/features/workday/api/photos'

export class CaptureError extends Error {}

const MESSAGES: Record<number, string> = {
  402: 'La carga desde una captura es parte del plan pago.',
  403: 'Solo supervisores y administradores pueden cargar desde una captura.',
  429: 'Ya se usaron todas las capturas de este mes.',
  503: 'La lectura de capturas con IA todavía no está activada.',
}
const FAILED = 'No pudimos leer la captura. Probá con una más nítida, o pegá el texto.'

/**
 * Sends a capture of the routing list to be read by AI and returns its rows.
 * The image goes sharp enough to read small print (2400 px, JPEG 85 %) and without EXIF.
 */
export async function readCapture(file: File, companyId: string): Promise<{ rows: Partial<CaptureRow>[]; unreadable: number }> {
  const { blob } = await compressPhoto(file, 2400, 0.85).catch(() => {
    throw new CaptureError('Esa imagen no se puede abrir. Probá con una captura o una foto en JPG o PNG.')
  })
  const form = new FormData()
  form.append('file', new File([blob], 'captura.jpg', { type: 'image/jpeg' }))
  form.append('company', companyId)
  const { data, error } = await supabase.functions.invoke<{ rows: Partial<CaptureRow>[]; unreadable: number }>('read-capture', { body: form })
  if (error) {
    const status = error instanceof FunctionsHttpError ? (error.context as Response).status : 0
    throw new CaptureError(MESSAGES[status] ?? FAILED)
  }
  return { rows: data?.rows ?? [], unreadable: data?.unreadable ?? 0 }
}
