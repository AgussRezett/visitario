import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Enums } from '@/lib/supabase'
import { toCsv, type Subscription } from '@/domain/company'
import { formatTime } from '@/domain/dates'
import { CONSENT_LABEL, WORK_STATUS_LABEL } from '@/domain/visit'
import { EXPORT_VISIT_SELECT } from '@/features/workday/api/selects'

export interface CompanySettings {
  id: string
  name: string
  kind: Enums<'company_kind'>
  geocodingScope: Enums<'geocoding_scope'>
  showWhatsapp: boolean
  messagesPerDisplay: boolean
  photoRetentionMonths: number
  logoVersion: number | null
  /** The company's look: #rrggbb and the logo's path in the "logos" bucket. */
  brandColor: string | null
  logoPath: string | null
  shiftStart: string
  shiftEnd: string
}

export const companyQuery = (companyId: string) =>
  queryOptions({
    queryKey: ['admin', 'company', companyId],
    queryFn: async (): Promise<CompanySettings> => {
      const { data, error } = await supabase
        .from('company')
        .select('id, name, kind, geocoding_scope, show_whatsapp, messages_per_display, photo_retention_months, logo_version, brand_color, logo_path, shift_start, shift_end')
        .eq('id', companyId)
        .single()
      if (error) throw error
      return {
        id: data.id,
        name: data.name,
        kind: data.kind,
        geocodingScope: data.geocoding_scope,
        showWhatsapp: data.show_whatsapp,
        messagesPerDisplay: data.messages_per_display,
        photoRetentionMonths: data.photo_retention_months,
        logoVersion: data.logo_version,
        brandColor: data.brand_color,
        logoPath: data.logo_path,
        shiftStart: data.shift_start.slice(0, 5),
        shiftEnd: data.shift_end.slice(0, 5),
      }
    },
  })

export interface CompanyChange {
  name?: string
  geocodingScope?: Enums<'geocoding_scope'>
  showWhatsapp?: boolean
  messagesPerDisplay?: boolean
  photoRetentionMonths?: number
  shiftStart?: string
  shiftEnd?: string
}

export function useCompanyUpdate(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (c: CompanyChange) => {
      const { error } = await supabase
        .from('company')
        .update({ name: c.name, geocoding_scope: c.geocodingScope, show_whatsapp: c.showWhatsapp, messages_per_display: c.messagesPerDisplay, photo_retention_months: c.photoRetentionMonths, shift_start: c.shiftStart, shift_end: c.shiftEnd })
        .eq('id', companyId)
      if (error) throw new Error('No pudimos guardar el cambio. Probá de nuevo.')
    },
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['admin', 'company', companyId] }),
        qc.invalidateQueries({ queryKey: ['catalogs', companyId] }),
        qc.invalidateQueries({ queryKey: ['me'] }),
        qc.invalidateQueries({ queryKey: ['team', 'shifts', companyId] }),
      ]),
  })
}

export const subscriptionQuery = (companyId: string) =>
  queryOptions({
    queryKey: ['admin', 'subscription', companyId],
    queryFn: async (): Promise<Subscription | null> => {
      const { data, error } = await supabase.from('subscription').select('*').eq('company_id', companyId).maybeSingle()
      if (error) throw error
      if (!data) return null
      return {
        plan: data.plan,
        status: data.status,
        endsOn: data.ends_on,
        nextBillingOn: data.next_billing_on,
        autoDebit: data.auto_debit,
        paymentMethod: data.payment_method_summary,
        estimatedAmountCents: data.estimated_amount_cents,
        currency: data.currency,
      }
    },
  })

export interface Usage {
  activePeople: number
  photoBytes: number
  photos: number
  visitsThisMonth: number
  stores: number
  aiCapturesThisMonth: number
}

export const usageQuery = (companyId: string) =>
  queryOptions({
    queryKey: ['admin', 'usage', companyId],
    queryFn: async (): Promise<Usage> => {
      const { data, error } = await supabase.rpc('company_usage', { p_company: companyId })
      if (error) throw error
      const r = data?.[0]
      return {
        activePeople: r?.active_people ?? 0,
        photoBytes: Number(r?.photo_bytes ?? 0),
        photos: r?.photos ?? 0,
        visitsThisMonth: r?.visits_this_month ?? 0,
        stores: r?.stores ?? 0,
        aiCapturesThisMonth: r?.ai_captures_this_month ?? 0,
      }
    },
  })

const PAGE = 1000
const REVIEW_LABEL: Record<Enums<'review_status'>, string> = { unreviewed: 'Sin revisar', approved: 'Aprobada', needs_fix: 'Con corrección' }

/** Every row, a page at a time (PostgREST returns at most 1000 per request). */
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw new Error('No pudimos exportar. Probá de nuevo.')
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

/** The company's stores or visits as a CSV for Excel. Photos stay in Visitario. */
export async function exportCsv(companyId: string, what: 'stores' | 'visits') {
  if (what === 'stores') {
    const stores = await all((from, to) =>
      supabase.from('store').select('customer_number, name, address, area, location_status, created_at').eq('company_id', companyId).is('deleted_at', null).order('address').range(from, to),
    )
    return toCsv(
      ['Nro. de cliente', 'Nombre', 'Dirección', 'Zona', 'Ubicación', 'Alta'],
      stores.map((s) => [s.customer_number, s.name, s.address, s.area, s.location_status === 'verified' ? 'Verificada' : s.location_status === 'approximate' ? 'Aproximada' : 'Sin verificar', s.created_at.slice(0, 10)]),
    )
  }
  type Row = {
    work_date: string; work_status: Enums<'work_status'>; review_status: Enums<'review_status'>; consent: Enums<'consent_kind'> | null
    arrived_at: string | null; finished_at: string | null; task: string | null; notes: string | null
    store: { name: string | null; address: string; customer_number: string | null; area: string | null } | null
    merchandiser: { first_name: string; last_name: string } | null
  }
  const visits = await all<Row>((from, to) =>
    supabase.from('visit').select(EXPORT_VISIT_SELECT).eq('company_id', companyId).is('deleted_at', null).order('work_date').order('sort_order').range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
  )
  return toCsv(
    ['Fecha', 'Activador', 'Comercio', 'Dirección', 'Nro. de cliente', 'Zona', 'Estado', 'Autorización', 'Revisión', 'Llegada', 'Fin', 'Tarea', 'Notas'],
    visits.map((v) => [
      v.work_date,
      v.merchandiser ? `${v.merchandiser.first_name} ${v.merchandiser.last_name}` : '',
      v.store?.name, v.store?.address, v.store?.customer_number, v.store?.area,
      WORK_STATUS_LABEL[v.work_status], v.consent ? CONSENT_LABEL[v.consent] : '', REVIEW_LABEL[v.review_status],
      v.arrived_at ? formatTime(v.arrived_at) : '', v.finished_at ? formatTime(v.finished_at) : '', v.task, v.notes,
    ]),
  )
}

/** Hands the CSV to the browser as a download. */
export function saveFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Support sessions on the company: Visitario looking at its data, read only. */
export const supportLogQuery = (companyId: string) =>
  queryOptions({
    queryKey: ['admin', 'support-log', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_access')
        .select('id, reason, starts_at, ends_at')
        .eq('company_id', companyId)
        .order('starts_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data.map((a) => ({ id: a.id, reason: a.reason, startsAt: a.starts_at, endsAt: a.ends_at }))
    },
  })
