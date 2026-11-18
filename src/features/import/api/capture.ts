import { FunctionsHttpError } from '@supabase/supabase-js'
import { queryOptions, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { captureSlices, type Transcript } from '@/domain/capture'
import type { AiQuota } from '@/domain/ai-quota'
import { compressPhoto } from '@/features/workday/api/photos'

export class CaptureError extends Error {}

// What the server answers, by its error code (or its status when it gives none).
export const MESSAGES: Record<string, string> = {
  plan: 'La lectura con IA no está incluida en el plan de tu empresa.',
  forbidden: 'Tu usuario no puede leer capturas en esta empresa.',
  limit: 'Tu empresa usó toda la IA del mes: se renueva el 1. Mientras tanto, pegá el texto.',
  limit_person: 'Ya usaste la IA todo lo permitido por hoy: mañana se renueva. Mientras tanto, pegá el texto.',
  limit_platform: 'Por hoy se terminó la IA de Visitario: mañana se renueva. Mientras tanto, pegá el texto.',
  not_configured: 'La lectura de capturas con IA todavía no está activada.',
}
const BY_STATUS: Record<number, string> = { 402: 'plan', 403: 'forbidden', 429: 'limit', 503: 'not_configured' }
const FAILED = 'No pudimos leer la captura. Probá con una más nítida, o pegá el texto.'

export async function errorCode(error: unknown, messages: Record<string, string> = MESSAGES): Promise<string> {
  if (!(error instanceof FunctionsHttpError)) return ''
  const res = error.context as Response
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  return body?.error && messages[body.error] ? body.error : BY_STATUS[res.status] ?? ''
}

/** The capture as JPEGs to read: whole, or in overlapping slices when it is a long one. */
async function captureImages(file: File): Promise<Blob[]> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null)
  const slices = bitmap ? captureSlices(bitmap.width, bitmap.height) : []
  if (!bitmap || slices.length < 2) {
    bitmap?.close()
    const { blob } = await compressPhoto(file, 2400, 0.85)
    return [blob]
  }
  try {
    const width = Math.min(bitmap.width, 1600)
    const scale = width / bitmap.width
    return await Promise.all(slices.map(async (s) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = Math.round(s.height * scale)
      canvas.getContext('2d')?.drawImage(bitmap, 0, s.top, bitmap.width, s.height, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
      if (!blob) throw new Error('slice')
      return blob
    }))
  } finally {
    bitmap.close()
  }
}

/**
 * Sends a capture of the routing list to be transcribed by AI: its title, column titles and
 * cells, as they are. What each column holds is decided in the app.
 * The image goes sharp enough to read small print (2400 px, JPEG 85 %) and without EXIF; a
 * long one (a scrolled list) in overlapping slices, so every row stays readable.
 */
export async function readCapture(file: File, companyId: string): Promise<Transcript> {
  const images = await captureImages(file).catch(() => {
    throw new CaptureError('Esa imagen no se puede abrir. Probá con una captura o una foto en JPG o PNG.')
  })
  const form = new FormData()
  images.forEach((blob, i) => form.append('file', new File([blob], `captura-${i + 1}.jpg`, { type: 'image/jpeg' })))
  form.append('company', companyId)
  const { data, error } = await supabase.functions.invoke<Partial<Transcript>>('read-capture', { body: form })
  if (error) throw new CaptureError(MESSAGES[await errorCode(error)] ?? FAILED)
  return { title: data?.title ?? '', headers: data?.headers ?? [], rows: data?.rows ?? [], unreadable: data?.unreadable ?? 0 }
}

/** What is left of the AI for me in this company: its month and my day. */
export const aiQuotaQuery = (companyId: string) =>
  queryOptions({
    queryKey: ['ai-quota', companyId],
    staleTime: 60_000,
    queryFn: async (): Promise<AiQuota | null> => {
      const { data, error } = await supabase.rpc('ai_quota', { p_company: companyId })
      if (error) throw error
      const r = data?.[0]
      return r ? { monthUsed: r.month_used, monthLimit: r.month_limit, myToday: r.my_today, myDailyLimit: r.my_daily_limit } : null
    },
  })

/** After a capture, read what is left again. */
export function useRefreshQuota(companyId: string) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['ai-quota', companyId] })
}
