import { supabase, type Enums } from '@/lib/supabase'
import { workdayErrorMessage } from '@/features/workday/api/errors'

/** Visit fields the merchandiser records. */
export type VisitFields = Partial<{
  work_status: Enums<'work_status'>
  arrived_at: string | null
  consent: Enums<'consent_kind'> | null
  objection: string | null
  retry_after: string | null
  notes: string | null
  task: string | null
}>

interface Base {
  visitId: string
  companyId: string
}

/**
 * Every change the merchandiser can make without signal. Each one is safe to send twice:
 * updates set values, and new records carry their id from the phone.
 */
export type Op =
  | (Base & { kind: 'visit.patch'; patch: VisitFields })
  | (Base & { kind: 'visit.remove' })
  | (Base & { kind: 'display.add'; displayId: string; typeId: number; sortOrder: number })
  | (Base & { kind: 'display.patch'; displayId: string; typeId?: number; reference?: string | null })
  | (Base & { kind: 'display.remove'; displayId: string })
  | (Base & { kind: 'photo.add'; photoId: string; displayId: string | null; photoKind: Enums<'photo_kind'>; takenAt: string; width: number; height: number; sortOrder: number })
  | (Base & { kind: 'photo.remove'; photoId: string })
  | (Base & { kind: 'metric.set'; metricId: number; quantity: number })
  | (Base & { kind: 'brand.set'; brandId: number; on: boolean })

/** The server refused the change: retrying the same thing will not help. */
export class PermanentError extends Error {}

/** 4xx means the server looked at it and said no; auth, timeouts and rate limits can pass. */
export const isPermanentStatus = (status: number) => status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429

function check(res: { error: { message: string; code?: string } | null; status: number }) {
  if (!res.error) return
  if (isPermanentStatus(res.status)) throw new PermanentError(workdayErrorMessage(res.error))
  throw new Error(res.error.message)
}

const PHOTO_ERRORS: Record<number, string> = {
  403: 'El servidor no aceptó la foto para esta visita.',
  404: 'La visita ya no existe.',
  413: 'La foto es demasiado grande.',
  415: 'El archivo no es una foto válida.',
}

/** Sends one change. Throws PermanentError when the server refuses it, any other error to retry. */
export async function send(op: Op, blob?: Blob) {
  const now = () => new Date().toISOString()
  switch (op.kind) {
    case 'visit.patch':
      return check(await supabase.from('visit').update(op.patch).eq('id', op.visitId))
    case 'visit.remove':
      return check(await supabase.from('visit').update({ deleted_at: now() }).eq('id', op.visitId).is('deleted_at', null))
    case 'display.add':
      return check(
        await supabase
          .from('display')
          .upsert(
            { id: op.displayId, company_id: op.companyId, visit_id: op.visitId, display_type_id: op.typeId, source: 'found', sort_order: op.sortOrder },
            { onConflict: 'id', ignoreDuplicates: true },
          ),
      )
    case 'display.patch':
      return check(await supabase.from('display').update({ display_type_id: op.typeId, reference: op.reference }).eq('id', op.displayId))
    case 'display.remove':
      return check(await supabase.from('display').update({ deleted_at: now() }).eq('id', op.displayId).is('deleted_at', null))
    case 'photo.remove':
      return check(await supabase.from('photo').update({ deleted_at: now() }).eq('id', op.photoId).is('deleted_at', null))
    case 'metric.set':
      return check(
        await supabase
          .from('visit_metric')
          .upsert({ company_id: op.companyId, visit_id: op.visitId, metric_id: op.metricId, quantity: op.quantity }, { onConflict: 'visit_id,metric_id' }),
      )
    case 'brand.set':
      return check(
        op.on
          ? await supabase.from('visit_brand').upsert({ company_id: op.companyId, visit_id: op.visitId, brand_id: op.brandId }, { onConflict: 'visit_id,brand_id', ignoreDuplicates: true })
          : await supabase.from('visit_brand').delete().eq('visit_id', op.visitId).eq('brand_id', op.brandId),
      )
    case 'photo.add': {
      if (!blob) throw new PermanentError('Falta el archivo de la foto.')
      const form = new FormData()
      form.append('file', blob, `${op.photoId}.jpg`)
      form.append(
        'meta',
        JSON.stringify({ id: op.photoId, visitId: op.visitId, displayId: op.displayId, kind: op.photoKind, takenAt: op.takenAt, width: op.width, height: op.height, sortOrder: op.sortOrder }),
      )
      const { error } = await supabase.functions.invoke('photos', { body: form })
      if (!error) return
      const status = (error as { context?: { status?: number } }).context?.status ?? 0
      if (isPermanentStatus(status)) throw new PermanentError(PHOTO_ERRORS[status] ?? 'El servidor no aceptó la foto.')
      throw error
    }
  }
}

const PHOTO_LABEL = { storefront: 'Foto de fachada', before: 'Foto del antes', after: 'Foto del después' } as const

/** What the merchandiser sees for a pending change, without the place (added by the caller). */
export function describe(op: Op): string {
  switch (op.kind) {
    case 'visit.patch': {
      const p = op.patch
      if (p.work_status === 'done' || p.work_status === 'refused' || (p.work_status === 'closed' && !('consent' in p))) return 'Visita terminada'
      if (p.work_status) return 'Estado de la visita'
      if ('consent' in p) return 'Autorización del local'
      if ('notes' in p) return 'Notas'
      if ('objection' in p) return 'Oposición'
      if ('retry_after' in p) return 'Volver más tarde'
      return 'Cambio en la visita'
    }
    case 'visit.remove':
      return 'Quitar de la jornada'
    case 'display.add':
      return 'Exhibición nueva'
    case 'display.patch':
      return 'Datos de la exhibición'
    case 'display.remove':
      return 'Quitar exhibición'
    case 'photo.add':
      return PHOTO_LABEL[op.photoKind]
    case 'photo.remove':
      return 'Borrar foto'
    case 'metric.set':
      return 'Trabajo realizado'
    case 'brand.set':
      return 'Marcas trabajadas'
  }
}
