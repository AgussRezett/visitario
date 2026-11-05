import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Range } from '@/domain/report-period'

// The photo presentation: the authorized, finished visits of a period with the "después"
// of each display, ready to be laid out one slide per visit.

export interface SlidePhoto {
  id: string
  /** width / height, as uploaded (already upright). */
  aspect: number
}

export interface SlideVisit {
  id: string
  date: string
  merchandiserId: string
  merchandiser: { first: string; last: string }
  address: string
  customerNumber: string | null
  area: string | null
  channelId: number | null
  sellerId: number | null
  /** The "después" of every display, in the displays' order. */
  photos: SlidePhoto[]
}

interface Row {
  id: string
  work_date: string
  merchandiser_id: string
  sort_order: number
  merchandiser: { first_name: string; last_name: string } | null
  store: { address: string; customer_number: string | null; area: string | null; channel_id: number | null; seller_id: number | null } | null
  display: { id: string; sort_order: number; deleted_at: string | null }[]
  photo: { id: string; kind: string; display_id: string | null; sort_order: number; width: number | null; height: number | null; uploaded_at: string | null; deleted_at: string | null; created_at: string }[]
}

const SELECT = `
  id, work_date, merchandiser_id, sort_order,
  merchandiser:person!visit_merchandiser_id_fkey (first_name, last_name),
  store:store!visit_company_id_store_id_fkey (address, customer_number, area, channel_id, seller_id),
  display:display!display_company_id_visit_id_fkey (id, sort_order, deleted_at),
  photo:photo!photo_company_id_visit_id_fkey (id, kind, display_id, sort_order, width, height, uploaded_at, deleted_at, created_at)`

const PAGE = 500

/** Authorized (with or without objection) and finished: what the cover's total counts. */
export const slidesQuery = (companyId: string, range: Range) =>
  queryOptions({
    queryKey: ['team', 'slides', companyId, range.from, range.to] as const,
    enabled: Boolean(companyId),
    queryFn: async (): Promise<SlideVisit[]> => {
      const rows: Row[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('visit')
          .select(SELECT)
          .eq('company_id', companyId)
          .gte('work_date', range.from)
          .lte('work_date', range.to)
          .eq('work_status', 'done')
          .in('consent', ['yes', 'with_objection'])
          .is('deleted_at', null)
          .order('work_date')
          .order('merchandiser_id')
          .order('sort_order')
          .range(from, from + PAGE - 1)
        if (error) throw error
        rows.push(...(data as unknown as Row[]))
        if (!data || data.length < PAGE) break
      }
      return rows.map(toSlideVisit)
    },
  })

function toSlideVisit(r: Row): SlideVisit {
  const displays = r.display.filter((d) => !d.deleted_at).sort((a, b) => a.sort_order - b.sort_order)
  const place = new Map(displays.map((d, i) => [d.id, i]))
  const photos = r.photo
    .filter((p) => p.kind === 'after' && !p.deleted_at && p.uploaded_at && p.display_id && place.has(p.display_id))
    .sort((a, b) => (place.get(a.display_id ?? '') ?? 0) - (place.get(b.display_id ?? '') ?? 0) || a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
    .map((p) => ({ id: p.id, aspect: p.width && p.height ? p.width / p.height : 4 / 3 }))
  return {
    id: r.id, date: r.work_date, merchandiserId: r.merchandiser_id,
    merchandiser: { first: r.merchandiser?.first_name ?? '', last: r.merchandiser?.last_name ?? '' },
    address: r.store?.address ?? 'Sin dirección', customerNumber: r.store?.customer_number ?? null, area: r.store?.area ?? null,
    channelId: r.store?.channel_id ?? null, sellerId: r.store?.seller_id ?? null,
    photos,
  }
}

/**
 * A photo's file, through Visitario's photos function: the bucket only lets the browser show
 * its links, not read them, so the bytes come this way (with the same permissions).
 */
export async function photoFile(id: string): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke<Blob>('photos/file', { body: { id } })
  if (error || !(data instanceof Blob) || !data.size) throw new Error('photo')
  return data
}

/** Where the company's backgrounds are (public files in the "slides" bucket). */
export const slideAssetUrl = (path: string | null) => (path ? supabase.storage.from('slides').getPublicUrl(path).data.publicUrl : null)
