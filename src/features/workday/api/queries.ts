import { type QueryClient, queryOptions } from '@tanstack/react-query'
import { supabase, type Enums } from '@/lib/supabase'
import { VISIT_SELECT } from './selects'
import { workdayKeys } from './keys'

// ---- Shapes the screens use (camelCase, already joined)

export interface Store {
  id: string
  name: string | null
  address: string
  area: string | null
  customerNumber: string | null
  lat: number | null
  lng: number | null
  locationStatus: Enums<'location_status'>
  /** The kind of shop and who sells to it (names in the catalogs). */
  channelId: number | null
  sellerId: number | null
}

export interface Photo {
  id: string
  kind: Enums<'photo_kind'>
  displayId: string | null
  takenAt: string
  uploaded: boolean
}

export interface Display {
  id: string
  typeId: number
  reference: string | null
  source: Enums<'display_source'>
  sortOrder: number
}

export interface Visit {
  id: string
  companyId: string
  workdayId: string
  workDate: string
  sortOrder: number
  task: string | null
  source: Enums<'visit_source'>
  addedByName: string | null
  addedByMe: boolean
  resumedFrom: string | null
  workStatus: Enums<'work_status'>
  reviewStatus: Enums<'review_status'>
  /** Approved on finishing (nobody reviews this merchandiser): still theirs to fix. */
  autoApproved: boolean
  arrivedAt: string | null
  consent: Enums<'consent_kind'> | null
  objection: string | null
  retryAfter: string | null
  finishedAt: string | null
  notes: string | null
  rapport: Enums<'rapport_kind'> | null
  store: Store
  displays: Display[]
  photos: Photo[]
}

export interface Workday {
  id: string
  companyId: string
  workDate: string
  status: Enums<'workday_status'>
  createdByMe: boolean
}


export type VisitRow = {
  id: string
  company_id: string
  workday_id: string
  work_date: string
  sort_order: number
  task: string | null
  source: Enums<'visit_source'>
  added_by: string
  resumed_from: string | null
  work_status: Enums<'work_status'>
  review_status: Enums<'review_status'>
  /** Not in every select (team views): missing means not auto-approved. */
  auto_approved?: boolean
  arrived_at: string | null
  consent: Enums<'consent_kind'> | null
  objection: string | null
  retry_after: string | null
  finished_at: string | null
  notes: string | null
  rapport?: Enums<'rapport_kind'> | null
  adder: { first_name: string } | null
  store: { id: string; name: string | null; address: string; area: string | null; customer_number: string | null; lat: number | null; lng: number | null; location_status: Enums<'location_status'>; channel_id?: number | null; seller_id?: number | null } | null
  display: { id: string; display_type_id: number; reference: string | null; source: Enums<'display_source'>; sort_order: number; deleted_at: string | null }[]
  photo: { id: string; kind: Enums<'photo_kind'>; display_id: string | null; taken_at: string; uploaded_at: string | null; deleted_at: string | null }[]
}

export function toVisit(r: VisitRow, personId: string): Visit {
  const s = r.store
  return {
    id: r.id,
    companyId: r.company_id,
    workdayId: r.workday_id,
    workDate: r.work_date,
    sortOrder: r.sort_order,
    task: r.task,
    source: r.source,
    addedByName: r.adder?.first_name ?? null,
    addedByMe: r.added_by === personId,
    resumedFrom: r.resumed_from,
    workStatus: r.work_status,
    reviewStatus: r.review_status,
    autoApproved: r.auto_approved ?? false,
    arrivedAt: r.arrived_at,
    consent: r.consent,
    objection: r.objection,
    retryAfter: r.retry_after,
    finishedAt: r.finished_at,
    notes: r.notes,
    rapport: r.rapport ?? null,
    store: {
      id: s?.id ?? '',
      name: s?.name ?? null,
      address: s?.address ?? '',
      area: s?.area ?? null,
      customerNumber: s?.customer_number ?? null,
      lat: s?.lat ?? null,
      lng: s?.lng ?? null,
      locationStatus: s?.location_status ?? 'unverified',
      channelId: s?.channel_id ?? null,
      sellerId: s?.seller_id ?? null,
    },
    displays: r.display
      .filter((d) => !d.deleted_at)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((d) => ({ id: d.id, typeId: d.display_type_id, reference: d.reference, source: d.source, sortOrder: d.sort_order })),
    photos: r.photo
      .filter((p) => !p.deleted_at)
      .sort((a, b) => a.taken_at.localeCompare(b.taken_at))
      .map((p) => ({ id: p.id, kind: p.kind, displayId: p.display_id, takenAt: p.taken_at, uploaded: Boolean(p.uploaded_at) })),
  }
}

// ---- Keys

export { workdayKeys }

// ---- Queries

export const workdayQuery = (companyId: string, personId: string, date: string) =>
  queryOptions({
    queryKey: workdayKeys.day(companyId, date),
    queryFn: async (): Promise<Workday | null> => {
      const { data, error } = await supabase
        .from('workday')
        .select('id, company_id, work_date, status, created_by')
        .eq('company_id', companyId)
        .eq('merchandiser_id', personId)
        .eq('work_date', date)
        .is('deleted_at', null)
        .maybeSingle()
      if (error) throw error
      return data && { id: data.id, companyId: data.company_id, workDate: data.work_date, status: data.status, createdByMe: data.created_by === personId }
    },
  })

export const visitsQuery = (workdayId: string, personId: string) =>
  queryOptions({
    queryKey: workdayKeys.visits(workdayId),
    queryFn: async () => {
      const { data, error } = await supabase.from('visit').select(VISIT_SELECT).eq('workday_id', workdayId).is('deleted_at', null).order('sort_order')
      if (error) throw error
      return (data as unknown as VisitRow[]).map((r) => toVisit(r, personId))
    },
  })

/** The visit as the day's list already has it, so opening it shows at once (then refreshes). */
export function visitFromLists(qc: QueryClient, visitId: string) {
  for (const [key, list] of qc.getQueriesData<Visit[]>({ queryKey: ['workday', 'visits'] })) {
    const found = list?.find((v) => v.id === visitId)
    if (found) return { data: found, updatedAt: qc.getQueryState(key)?.dataUpdatedAt ?? 0 }
  }
  return undefined
}

export const visitQuery = (visitId: string, personId: string) =>
  queryOptions({
    queryKey: workdayKeys.visit(visitId),
    queryFn: async () => {
      const { data, error } = await supabase.from('visit').select(VISIT_SELECT).eq('id', visitId).maybeSingle()
      if (error) throw error
      return data ? toVisit(data as unknown as VisitRow, personId) : null
    },
  })

export interface WorkdaySummary {
  id: string
  workDate: string
  total: number
  visited: number
  pending: number
}

export const historyQuery = (companyId: string, personId: string) =>
  queryOptions({
    queryKey: workdayKeys.history(companyId),
    queryFn: async (): Promise<WorkdaySummary[]> => {
      const [days, progress] = await Promise.all([
        supabase.from('workday').select('id, work_date').eq('company_id', companyId).eq('merchandiser_id', personId).is('deleted_at', null).order('work_date', { ascending: false }).limit(30),
        supabase.from('daily_progress').select('work_date, total, visited').eq('company_id', companyId).eq('merchandiser_id', personId).order('work_date', { ascending: false }).limit(30),
      ])
      if (days.error) throw days.error
      if (progress.error) throw progress.error
      const byDate = new Map(progress.data.map((p) => [p.work_date, p]))
      return days.data.map((d) => {
        const p = byDate.get(d.work_date)
        const total = p?.total ?? 0
        const visited = p?.visited ?? 0
        return { id: d.id, workDate: d.work_date, total, visited, pending: total - visited }
      })
    },
  })

export const resumableQuery = (companyId: string, before: string) =>
  queryOptions({
    queryKey: workdayKeys.resumable(companyId, before),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('resumable_visits', { p_company: companyId, p_before: before })
      if (error) throw error
      return data
    },
  })


/** Work quantities and brands of one visit. */
export const visitWorkQuery = (visitId: string) =>
  queryOptions({
    queryKey: ['workday', 'visit-work', visitId] as const,
    queryFn: async () => {
      const [metrics, brands] = await Promise.all([
        supabase.from('visit_metric').select('metric_id, quantity').eq('visit_id', visitId),
        supabase.from('visit_brand').select('brand_id').eq('visit_id', visitId),
      ])
      if (metrics.error) throw metrics.error
      if (brands.error) throw brands.error
      return {
        metrics: Object.fromEntries(metrics.data.map((m) => [m.metric_id, m.quantity])) as Record<number, number>,
        brands: brands.data.map((b) => b.brand_id),
      }
    },
  })

/** Totals per metric for a day's report. */
export const dayMetricsQuery = (companyId: string, personId: string, date: string) =>
  queryOptions({
    queryKey: ['workday', 'day-metrics', companyId, date] as const,
    queryFn: async () => {
      const { data, error } = await supabase.from('daily_metrics').select('metric_id, quantity').eq('company_id', companyId).eq('merchandiser_id', personId).eq('work_date', date)
      if (error) throw error
      return Object.fromEntries(data.map((m) => [m.metric_id, m.quantity])) as Record<number, number>
    },
  })

export { catalogsQuery, useCatalogs, type Catalogs } from './catalogs'
